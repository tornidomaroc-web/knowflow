import { Locale } from '@/lib/i18n';
import { SUPPORT_EMAIL } from '@/lib/site';
import { PlatformText } from '@/components/platform/PlatformText';
import { AppStoreOnly } from '@/components/legal/AppStoreOnly';

export default async function PrivacyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const isRtl = locale === 'ar';

  return (
    <div className="py-24" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-3xl mx-auto px-6 text-muted-foreground text-start [text-wrap:pretty] [&_h1]:text-balance [&_h2]:text-balance">
        <h1 className="text-[2rem] leading-[1.2] sm:text-5xl font-bold mb-4 text-foreground">Privacy Policy</h1>
        <p className="text-sm uppercase tracking-wide font-medium text-primary mb-12">Last updated: November 2026</p>

        <p className="mb-6">This Privacy Policy applies to KnowFlow, the study service at tryknowflow.com. KnowFlow is operated by Abdelfettah Amellah, and the contact address given below reaches the person responsible for it.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Information We Collect</h2>
        <p className="mb-6">We collect information you provide directly to us when you create an account, upload materials, or contact us. This includes your name, your email address, and the content of the files you upload to your subjects.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">How We Use Your Information</h2>
        <p className="mb-6">We use what we collect to run KnowFlow: to store your materials, to answer your questions from them, to generate summaries and quizzes, and to count your usage against <PlatformText web="the limits of your plan" app="your account's limits" />. We do not sell your personal data or the content of your materials, and we do not use them for advertising.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Who We Share It With</h2>
        <p className="mb-6">KnowFlow is built on services run by other companies. Each one is used only to provide the part of KnowFlow described here. We do not authorise any of them to use your content for their own purposes, and none of them pays us for your data. We require each of them to protect your data to the standard this policy describes and to use it only to provide their service to us.</p>
        <ul className="mb-6 space-y-3 list-disc ps-6">
          <li><strong>Supabase</strong> stores your account, the files you upload, your materials, your conversations and your quizzes.</li>
          <li><strong>Anthropic</strong> generates your summaries, your quizzes, and the answers to your questions.</li>
          <li><strong>Voyage AI</strong>, part of MongoDB, converts the text of your materials and your questions into the numerical form the search uses, so that KnowFlow can find the right passage.</li>
          {/* Step Wording-1: the app's variant names no plan and no other way to pay (3.1.1); the processor is still disclosed. It no longer says "nothing is paid inside this app": from build 9 the app sells KnowFlow Pro through the App Store (the next item). */}
          <li><strong>Paddle</strong><PlatformText web=" takes the payment if you subscribe to Pro on this website. Paddle is the seller of record and collects your payment details directly, so we never see your card." app=", only for a payment made through Paddle. Paddle is the seller of record for it and collects the payment details directly, so we never see a card." /></li>
          {/* Item 4j, store step 2: the web always; the app only where the KnowFlowStore plugin answers (build 9), marked. */}
          <AppStoreOnly as="li" mark="privacy-processor"><strong>Apple&apos;s App Store</strong>, only if you subscribe to KnowFlow Pro in the app. Apple takes the payment and keeps your payment details, so we never see them. When you subscribe, the app gives Apple your KnowFlow account&apos;s identifier, so that the purchase is matched to your account, and Apple sends KnowFlow a signed record of the subscription: its transaction number, the product, whether it is active and when it renews or ends. KnowFlow keeps that record with your account.</AppStoreOnly>
          <li><strong>Resend</strong> sends the emails KnowFlow has to send you, such as your sign-up confirmation and password resets.</li>
          <li><strong>Vercel</strong> hosts the website and handles every request made to it.</li>
          <li><strong>Railway</strong> runs the service that reads your uploaded file and turns it into text.</li>
          <li><strong>Google</strong>, only if you choose Sign in with Google. If you sign in with an email address and a password, Google is not involved.</li>
          {/* DRAFT (Sign in with Apple, item 4f): docs/copy-drafts/siwa_v1.md. */}
          <li><strong>Apple</strong>, only if you choose Sign in with Apple in the app. Apple gives KnowFlow an email address, which can be a private address that forwards to yours, and your name the first time you sign in. When you delete your account in the app, KnowFlow asks Apple to end its access.</li>
        </ul>
        <p className="mb-6"><strong>Anthropic and Voyage AI receive the text of your materials and your questions. They do not receive your name or your email address</strong>, because KnowFlow does not send those along with the text.</p>
        {/* DRAFT (the camera screen): docs/copy-drafts/camera_screen.md. */}
        <p className="mb-6"><strong>If you photograph pages in the app, Anthropic also receives those photos, to read their text.</strong> KnowFlow deletes each photo from its storage once it has been read, and asks your permission for photos before the first one is sent.</p>
        <p className="mb-6" data-kf-privacy-voice="">When you ask with your voice in the app, Apple&apos;s speech recognition turns your question into text, on your phone when it can and otherwise on Apple&apos;s servers. KnowFlow receives only the text you choose to send, never the recording.</p>
        <p className="mb-6"><strong>We ask your permission before anything is sent to Anthropic or Voyage AI.</strong> The first time you upload a file, ask a question, or ask for a summary or a quiz, KnowFlow shows you who receives what and sends nothing until you agree. You can withdraw the permission at any time in Settings; from then on nothing new is sent, and uploading, asking, summaries and quizzes are unavailable until you give it again.</p>
        <p className="mb-6">The terms Anthropic publishes state that it does not train its models on content sent through its API. Voyage AI is set to zero retention on our account, so content sent from 12 September 2026 onward is deleted after it has been processed and is not used to improve their models.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Data Storage and Security</h2>
        <p className="mb-6">Your uploaded files are kept in private storage that is not readable from the public internet, in a folder that belongs to your account. The database applies row-level rules so that your subjects, materials, conversations, quizzes and study history can only be read by your own signed-in account. The site is served over HTTPS.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Your Rights</h2>
        <p className="mb-6">You can view the materials you have uploaded, and the email address on your account, from your dashboard.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Deleting Your Account and Data</h2>
        <p className="mb-6"><strong>You can delete your account yourself, from Settings in your dashboard.</strong> Deleting your account permanently removes your subjects, materials, conversations, quizzes and study history, together with every file you have uploaded, and <PlatformText web="immediately cancels a subscription paid through Paddle" app="stops any recurring payment made through Paddle" />. It cannot be undone, and nothing can be restored afterwards. {/* Item 4j, store step 2 (Apple 5.1.1(v)): the same gate as above. */}<AppStoreOnly as="span" mark="privacy-delete">Deleting your account does not cancel an App Store subscription: cancel it in your Apple Account settings.</AppStoreOnly> Changing your account details is still not available.</p>
        <p className="mb-6">If you cannot reach your dashboard, you can still request deletion of your account and its associated data by emailing <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the address you registered with.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">How Long We Keep It</h2>
        <p className="mb-6">We keep your account and everything in it until you delete it. Nothing is removed automatically and there is no expiry date.</p>
        <p className="mb-6">Two things do not go when your account does. If a deletion fails part of the way through, we keep a record holding your account id and your email address so that we can finish it by hand. And the services listed above keep their own records under their own policies; the payment records Paddle holds are kept for tax and accounting.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Contact Us</h2>
        <p className="mb-6">If you have any questions about this Privacy Policy, please contact us at {SUPPORT_EMAIL}.</p>
      </div>
    </div>
  );
}
