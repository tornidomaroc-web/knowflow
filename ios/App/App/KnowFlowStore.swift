import Capacitor
import StoreKit
import UIKit

/// IN-APP PRO, THE NATIVE HALF (iOS 1.1, item 4d). StoreKit 2 only, in this
/// repository: no RevenueCat, no paid service, no third-party package.
///
/// One product, `com.knowflow.app.pro.monthly` (src/lib/apple-iap/rules.ts,
/// APPLE_PRO_PRODUCT_ID; the same bytes in src/lib/iap/flow.ts). The page
/// reaches this plugin through the bridge (`window.Capacitor.nativePromise`,
/// src/lib/iap/bridge.ts) and does every network call itself, with the
/// student's own session: this file never talks to tryknowflow.com.
///
/// THE RULE: no transaction is finished here on its own. `finish` is called by
/// the page only after POST /api/apple/iap/verify answered 200 for it
/// (src/lib/iap/flow.ts, verifyThenFinish). Until then StoreKit keeps it
/// unfinished, and `pending` hands it back at the next launch.
///
/// Registered by MainViewController (`registerPluginInstance`), the way
/// Capacitor documents a plugin that lives in the app target; the
/// `Transaction.updates` listener starts there, at launch, as Apple asks, so
/// a renewal, an Ask to Buy approval or a purchase made on another device is
/// kept until a page asks for it.
@objc(KnowFlowStorePlugin)
public class KnowFlowStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KnowFlowStorePlugin"
    public let jsName = "KnowFlowStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pending", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise),
    ]

    static let productId = "com.knowflow.app.pro.monthly"

    private let held = Held()
    private var updates: Task<Void, Never>?

    /// The launch listener. Idempotent: MainViewController calls it right after
    /// registering, and Capacitor's own `load()` may call it again.
    func startListening() {
        guard updates == nil else { return }
        let held = self.held
        updates = Task.detached {
            for await result in Transaction.updates {
                guard case .verified(let tx) = result, tx.productID == KnowFlowStorePlugin.productId else { continue }
                await held.put(tx, jws: result.jwsRepresentation)
            }
        }
    }

    override public func load() {
        startListening()
    }

    deinit {
        updates?.cancel()
    }

    /// `{ products: [{ id, displayPrice }] }`. Empty when the App Store has no
    /// product to sell (no Paid Applications Agreement yet, a storefront where
    /// it is not offered, no network): the page then shows "unavailable" and
    /// no buy button. The price is StoreKit's, never computed here.
    @objc func products(_ call: CAPPluginCall) {
        Task {
            do {
                let found = try await Product.products(for: [KnowFlowStorePlugin.productId])
                call.resolve(["products": found.map { ["id": $0.id, "displayPrice": $0.displayPrice] }])
            } catch {
                call.resolve(["products": [], "message": String(describing: error)])
            }
        }
    }

    /// `{ outcome: purchased, jws, transactionId } | pending | cancelled | failed`.
    /// `appAccountToken` is the signed-in KnowFlow user's id; the server grants
    /// nothing to a transaction whose token is another account's.
    @objc func purchase(_ call: CAPPluginCall) {
        guard let raw = call.getString("appAccountToken"), let token = UUID(uuidString: raw) else {
            call.resolve(["outcome": "failed", "message": "no account token"])
            return
        }
        let held = self.held
        Task {
            do {
                guard let product = try await Product.products(for: [KnowFlowStorePlugin.productId]).first else {
                    call.resolve(["outcome": "failed", "message": "product unavailable"])
                    return
                }
                let result = try await product.purchase(options: [.appAccountToken(token)])
                switch result {
                case .success(let verification):
                    guard case .verified(let tx) = verification else {
                        call.resolve(["outcome": "failed", "message": "unverified transaction"])
                        return
                    }
                    await held.put(tx, jws: verification.jwsRepresentation)
                    call.resolve(["outcome": "purchased", "jws": verification.jwsRepresentation, "transactionId": String(tx.id)])
                case .pending:
                    // Ask to Buy, or a payment that needs the student's action:
                    // the approval arrives later through Transaction.updates.
                    call.resolve(["outcome": "pending"])
                case .userCancelled:
                    call.resolve(["outcome": "cancelled"])
                @unknown default:
                    call.resolve(["outcome": "failed", "message": "unknown result"])
                }
            } catch StoreKitError.userCancelled {
                call.resolve(["outcome": "cancelled"])
            } catch {
                call.resolve(["outcome": "failed", "message": String(describing: error)])
            }
        }
    }

    /// Restore Purchases: `AppStore.sync()` (it may ask for the Apple Account),
    /// then every current Pro entitlement. A refused or failed sync still
    /// reads what the phone already knows.
    @objc func restore(_ call: CAPPluginCall) {
        let held = self.held
        Task {
            try? await AppStore.sync()
            var out: [[String: String]] = []
            for await result in Transaction.currentEntitlements {
                guard case .verified(let tx) = result, tx.productID == KnowFlowStorePlugin.productId else { continue }
                await held.put(tx, jws: result.jwsRepresentation)
                out.append(["jws": result.jwsRepresentation, "transactionId": String(tx.id)])
            }
            call.resolve(["transactions": out])
        }
    }

    /// What is waiting for the server: `Transaction.unfinished` and whatever
    /// the launch listener kept since.
    @objc func pending(_ call: CAPPluginCall) {
        let held = self.held
        Task {
            for await result in Transaction.unfinished {
                guard case .verified(let tx) = result, tx.productID == KnowFlowStorePlugin.productId else { continue }
                await held.put(tx, jws: result.jwsRepresentation)
            }
            call.resolve(["transactions": await held.all()])
        }
    }

    /// Called by the page ONLY after the server answered 200 for this transaction.
    @objc func finish(_ call: CAPPluginCall) {
        guard let raw = call.getString("transactionId"), let id = UInt64(raw) else {
            call.resolve(["finished": false])
            return
        }
        let held = self.held
        Task {
            if let tx = await held.take(id) {
                await tx.finish()
                call.resolve(["finished": true])
                return
            }
            for await result in Transaction.unfinished {
                if case .verified(let tx) = result, tx.id == id {
                    await tx.finish()
                    call.resolve(["finished": true])
                    return
                }
            }
            call.resolve(["finished": false])
        }
    }

    /// The App Store's own subscription sheet (manage or cancel).
    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("no window scene")
                return
            }
            do {
                try await AppStore.showManageSubscriptions(in: scene)
                call.resolve(["shown": true])
            } catch {
                call.reject(String(describing: error))
            }
        }
    }
}

/// The transactions this run has seen and not yet finished, by id.
private actor Held {
    private var byId: [UInt64: (Transaction, String)] = [:]

    func put(_ tx: Transaction, jws: String) {
        byId[tx.id] = (tx, jws)
    }

    func take(_ id: UInt64) -> Transaction? {
        byId.removeValue(forKey: id)?.0
    }

    func all() -> [[String: String]] {
        byId.values.map { ["jws": $0.1, "transactionId": String($0.0.id)] }
    }
}
