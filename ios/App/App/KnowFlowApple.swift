import AuthenticationServices
import Capacitor
import UIKit

/// SIGN IN WITH APPLE IN THE APP (iOS 1.1, big item 4f, PR 2 of 2). Apple's
/// own AuthenticationServices, in this repository: no third-party package, no
/// paid service, no web OAuth, no Services ID and no client secret.
///
/// The page reaches this plugin through the bridge (`window.Capacitor`,
/// src/lib/auth/apple-bridge.ts). Its presence is the page's gate: PR 1 shows
/// the Apple button and the Apple deletion step only where
/// `isPluginAvailable('KnowFlowApple')` is true in shell 2 on iOS, and only
/// this shell, which carries the Sign in with Apple entitlement
/// (App.entitlements), registers it.
///
/// TWO METHODS.
///  - `available()` resolves `{available: true}`. It opens nothing; the
///    plugin answering is the whole reading (ios-smoke proof 11).
///  - `signIn({nonce})` shows Apple's sheet once. `nonce` is the SHA-256 hex
///    of the page's raw nonce (makeNonce); Apple writes it into the identity
///    token and Supabase compares it with the raw value the page keeps. It
///    resolves exactly what `parseAuthorization()` reads: `identityToken`,
///    `authorizationCode` and `user` always, `email`, `givenName` and
///    `familyName` only when Apple gives them (the first authorization). It
///    rejects with code `canceled` when the student closes the sheet
///    (ASAuthorizationError 1001) and `failed` for anything else, including
///    a second call while a sheet is open.
///
/// NOTHING IS KEPT OR LOGGED. The token and the code go to the page and
/// nowhere else: no defaults, no keychain, no file. The log names the outcome
/// and the milliseconds only.
///
/// THREADS. Capacitor calls plugin methods off the main queue; the
/// controller, its presentation and the fields below are touched on the main
/// queue only. ASAuthorizationController holds its delegate weakly, so the
/// controller and the call are kept here until Apple answers.
@objc(KnowFlowApplePlugin)
public class KnowFlowApplePlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "KnowFlowApplePlugin"
    public let jsName = "KnowFlowApple"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
    ]

    // Read and written on the main queue only.
    private var pending: CAPPluginCall?
    private var controller: ASAuthorizationController?
    private var started = Date()

    @objc func available(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    @objc func signIn(_ call: CAPPluginCall) {
        // The page sends the hash, never the raw nonce: 64 lowercase hex.
        guard let nonce = call.getString("nonce"), nonce.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil else {
            NSLog("[KFApple] signIn refused: no hashed nonce")
            call.reject("Sign in with Apple needs the hashed nonce", "failed")
            return
        }
        DispatchQueue.main.async {
            if self.pending != nil {
                NSLog("[KFApple] signIn refused: a sheet is already open")
                call.reject("Sign in with Apple is already open", "failed")
                return
            }
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = nonce
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.pending = call
            self.controller = controller
            self.started = Date()
            controller.performRequests()
        }
    }

    // MARK: ASAuthorizationControllerPresentationContextProviding

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = bridge?.webView?.window { return window }
        if let window = bridge?.viewController?.view.window { return window }
        return ASPresentationAnchor()
    }

    // MARK: ASAuthorizationControllerDelegate (called on the main queue)

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let done = finish(controller) else { return }
        let (call, ms) = done
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken, let identityToken = String(data: tokenData, encoding: .utf8), !identityToken.isEmpty,
              let codeData = credential.authorizationCode, let authorizationCode = String(data: codeData, encoding: .utf8), !authorizationCode.isEmpty else {
            NSLog("[KFApple] signIn failed in %ld ms: no identity token or authorization code", ms)
            call.reject("Apple gave no identity token or authorization code", "failed")
            return
        }
        var out: [String: Any] = ["identityToken": identityToken, "authorizationCode": authorizationCode, "user": credential.user]
        // Apple gives these on the first authorization only; absent keys read as null in the page.
        if let value = credential.email, !value.isEmpty { out["email"] = value }
        if let value = credential.fullName?.givenName, !value.isEmpty { out["givenName"] = value }
        if let value = credential.fullName?.familyName, !value.isEmpty { out["familyName"] = value }
        NSLog("[KFApple] signIn authorized in %ld ms", ms)
        call.resolve(out)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let done = finish(controller) else { return }
        let (call, ms) = done
        // ASAuthorizationError.Code.canceled is 1001: the student closed the sheet.
        let number = (error as NSError).code
        if (error as? ASAuthorizationError)?.code == .canceled {
            NSLog("[KFApple] signIn canceled in %ld ms", ms)
            call.reject("Sign in with Apple was canceled", "canceled")
        } else {
            NSLog("[KFApple] signIn failed in %ld ms: error %ld", ms, number)
            call.reject("Sign in with Apple did not finish", "failed")
        }
    }

    /// The open call, once, for the controller this plugin started; the
    /// controller and the call are let go here.
    private func finish(_ controller: ASAuthorizationController) -> (CAPPluginCall, Int)? {
        guard controller === self.controller, let call = self.pending else { return nil }
        self.pending = nil
        self.controller = nil
        return (call, Int(Date().timeIntervalSince(started) * 1000))
    }
}
