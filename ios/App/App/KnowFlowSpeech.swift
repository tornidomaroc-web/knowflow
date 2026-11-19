import AVFoundation
import Capacitor
import Speech
import UIKit

/// VOICE INPUT IN ASK (iOS 1.1, big item 4e). Apple's SFSpeechRecognizer, in
/// this repository: no third-party package, no paid service, no account.
///
/// The page reaches this plugin through the bridge (`window.Capacitor`,
/// src/lib/speech/bridge.ts) and receives TEXT only: `partial` events while
/// the student speaks and an `end` event (and `stop()`'s answer) with the
/// final text. The microphone's buffers go into the recognizer and nowhere
/// else: no file is written, no buffer reaches the page or any server.
///
/// WHERE THE AUDIO GOES. With `requiresOnDeviceRecognition` (set wherever
/// `supportsOnDeviceRecognition` is true for the language) the audio never
/// leaves the phone. Where the phone has no on-device model for the language,
/// Apple's servers recognise it, under Apple's own system permission alert.
/// KnowFlow never receives audio.
///
/// A TAKE ENDS on the student's tap (`stop`), after 60 s, after about 3 s of
/// silence once words were heard (5 s before the first word), when the app
/// resigns active (home, a call, Control Center) and on an audio-session
/// interruption. Every way out restores the audio session the app had before
/// the take (category, mode and options), so the reminder's sound and any
/// other audio are as they were.
///
/// Registered by MainViewController (`registerPluginInstance`) beside
/// KnowFlowStore, in every build, so its presence in a web view proves the
/// shell carries NSMicrophoneUsageDescription and
/// NSSpeechRecognitionUsageDescription (Info.plist): iOS ends an app that
/// touches the microphone without them.
@objc(KnowFlowSpeechPlugin)
public class KnowFlowSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KnowFlowSpeechPlugin"
    public let jsName = "KnowFlowSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "availability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
    ]

    /// One take at most (Apple asks apps to plan for about a minute per request).
    static let limit: TimeInterval = 60
    /// Silence after words were heard.
    static let silence: TimeInterval = 3
    /// Silence before the first word.
    static let firstWords: TimeInterval = 5
    /// How long a stopped take waits for the recognizer's final text.
    static let finalWait: TimeInterval = 1.5

    // Every field below is read and written on the main queue only.
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var engine: AVAudioEngine?
    private var latest = ""
    private var active = false
    private var finishing = false
    private var endReason = "tap"
    private var endError: String?
    private var waiting: [CAPPluginCall] = []
    private var limitTimer: Timer?
    private var silenceTimer: Timer?
    private var finalTimer: Timer?
    private var observers: [NSObjectProtocol] = []
    private var saved = false
    private var previousCategory: AVAudioSession.Category = .soloAmbient
    private var previousMode: AVAudioSession.Mode = .default
    private var previousOptions: AVAudioSession.CategoryOptions = []

    deinit {
        observers.forEach { NotificationCenter.default.removeObserver($0) }
    }

    /// `{ locale, supported, available, onDevice, speech, mic }`. Reads only:
    /// no permission is asked here, so the page can decide to draw the
    /// microphone without an alert.
    @objc func availability(_ call: CAPPluginCall) {
        let id = call.getString("locale") ?? "en-US"
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: id))
        call.resolve([
            "locale": id,
            "supported": recognizer != nil,
            "available": recognizer?.isAvailable ?? false,
            "onDevice": recognizer?.supportsOnDeviceRecognition ?? false,
            "speech": KnowFlowSpeechPlugin.speechStatus(),
            "mic": KnowFlowSpeechPlugin.micStatus(),
        ])
    }

    /// `{ started: true, onDevice } | { started: false, error: denied | unsupported | failed | busy }`.
    /// Asks speech recognition, then the microphone, each only if never asked.
    @objc func start(_ call: CAPPluginCall) {
        let id = call.getString("locale") ?? "en-US"
        DispatchQueue.main.async {
            guard !self.active && !self.finishing else {
                call.resolve(["started": false, "error": "busy"])
                return
            }
            guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: id)) else {
                call.resolve(["started": false, "error": "unsupported"])
                return
            }
            self.authorize { granted in
                guard granted else {
                    call.resolve(["started": false, "error": "denied"])
                    return
                }
                self.begin(recognizer, call)
            }
        }
    }

    /// Ends the take; answers `{ text, reason, error? }` once the recognizer
    /// has given its final text (or after `finalWait`).
    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.active || self.finishing else {
                call.resolve(["text": "", "reason": "idle"])
                return
            }
            self.waiting.append(call)
            self.finish("tap")
        }
    }

    /// The app's page in Settings, where a refused permission is given back.
    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                call.resolve(["opened": false])
                return
            }
            UIApplication.shared.open(url) { opened in call.resolve(["opened": opened]) }
        }
    }

    // MARK: - Permissions

    private func authorize(_ done: @escaping (Bool) -> Void) {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized:
            authorizeMic(done)
        case .notDetermined:
            SFSpeechRecognizer.requestAuthorization { status in
                DispatchQueue.main.async {
                    if status == .authorized { self.authorizeMic(done) } else { done(false) }
                }
            }
        default:
            done(false)
        }
    }

    private func authorizeMic(_ done: @escaping (Bool) -> Void) {
        let session = AVAudioSession.sharedInstance()
        switch session.recordPermission {
        case .granted:
            done(true)
        case .undetermined:
            session.requestRecordPermission { granted in
                DispatchQueue.main.async { done(granted) }
            }
        default:
            done(false)
        }
    }

    private static func speechStatus() -> String {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized: return "granted"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "notDetermined"
        @unknown default: return "unknown"
        }
    }

    private static func micStatus() -> String {
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted: return "granted"
        case .denied: return "denied"
        case .undetermined: return "notDetermined"
        @unknown default: return "unknown"
        }
    }

    // MARK: - A take

    private func begin(_ recognizer: SFSpeechRecognizer, _ call: CAPPluginCall) {
        guard recognizer.isAvailable else {
            call.resolve(["started": false, "error": "unsupported"])
            return
        }
        let session = AVAudioSession.sharedInstance()
        previousCategory = session.category
        previousMode = session.mode
        previousOptions = session.categoryOptions
        saved = true
        do {
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            restoreSession()
            call.resolve(["started": false, "error": "failed"])
            return
        }
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }
        if #available(iOS 16.0, *) {
            request.addsPunctuation = true
        }
        let engine = AVAudioEngine()
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            restoreSession()
            call.resolve(["started": false, "error": "failed"])
            return
        }
        // The microphone's buffers go into the recognizer and nowhere else.
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { pcm, _ in
            request.append(pcm)
        }
        engine.prepare()
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            restoreSession()
            call.resolve(["started": false, "error": "failed"])
            return
        }
        self.request = request
        self.engine = engine
        latest = ""
        endReason = "tap"
        endError = nil
        finishing = false
        active = true
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async { self?.recognized(result, error) }
        }
        observe()
        limitTimer = Timer.scheduledTimer(withTimeInterval: KnowFlowSpeechPlugin.limit, repeats: false) { [weak self] _ in
            self?.finish("limit")
        }
        armSilence(KnowFlowSpeechPlugin.firstWords)
        call.resolve(["started": true, "onDevice": request.requiresOnDeviceRecognition])
    }

    private func recognized(_ result: SFSpeechRecognitionResult?, _ error: Error?) {
        guard active || finishing else { return }
        if let result = result {
            let text = result.bestTranscription.formattedString
            if text != latest {
                latest = text
                if active {
                    notifyListeners("partial", data: ["text": text])
                    armSilence(KnowFlowSpeechPlugin.silence)
                }
            }
            if result.isFinal {
                complete()
                return
            }
        }
        if let error = error {
            if latest.isEmpty {
                endError = KnowFlowSpeechPlugin.isNoSpeech(error) ? "noSpeech" : "failed"
            }
            if active { endReason = "error" }
            complete()
        }
    }

    /// "No speech detected" (kAFAssistantErrorDomain 1110; 203 on older systems).
    private static func isNoSpeech(_ error: Error) -> Bool {
        let e = error as NSError
        return e.domain == "kAFAssistantErrorDomain" && (e.code == 1110 || e.code == 203)
    }

    private func armSilence(_ after: TimeInterval) {
        silenceTimer?.invalidate()
        silenceTimer = Timer.scheduledTimer(withTimeInterval: after, repeats: false) { [weak self] _ in
            self?.finish("silence")
        }
    }

    /// Stops the audio and waits (at most `finalWait`) for the final text.
    private func finish(_ reason: String) {
        guard active else { return }
        endReason = reason
        stopAudio()
        finalTimer = Timer.scheduledTimer(withTimeInterval: KnowFlowSpeechPlugin.finalWait, repeats: false) { [weak self] _ in
            self?.complete()
        }
    }

    private func stopAudio() {
        active = false
        finishing = true
        limitTimer?.invalidate()
        limitTimer = nil
        silenceTimer?.invalidate()
        silenceTimer = nil
        if let engine = engine {
            engine.stop()
            engine.inputNode.removeTap(onBus: 0)
        }
        request?.endAudio()
    }

    /// The one way a take ends: everything released, the audio session given
    /// back, the text handed to the page.
    private func complete() {
        guard active || finishing else { return }
        if active { stopAudio() }
        finishing = false
        finalTimer?.invalidate()
        finalTimer = nil
        task?.cancel()
        task = nil
        request = nil
        engine = nil
        unobserve()
        restoreSession()
        var data: [String: Any] = ["text": latest, "reason": endReason]
        if let e = endError { data["error"] = e }
        notifyListeners("end", data: data)
        let calls = waiting
        waiting = []
        calls.forEach { $0.resolve(data) }
    }

    private func observe() {
        let center = NotificationCenter.default
        observers = [
            center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
                self?.finish("background")
            },
            center.addObserver(forName: AVAudioSession.interruptionNotification, object: AVAudioSession.sharedInstance(), queue: .main) { [weak self] note in
                guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                      AVAudioSession.InterruptionType(rawValue: raw) == .began else { return }
                self?.finish("interrupted")
            },
        ]
    }

    private func unobserve() {
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        observers = []
    }

    /// The category, mode and options the app had before the take.
    private func restoreSession() {
        guard saved else { return }
        saved = false
        let session = AVAudioSession.sharedInstance()
        try? session.setActive(false, options: .notifyOthersOnDeactivation)
        try? session.setCategory(previousCategory, mode: previousMode, options: previousOptions)
    }
}
