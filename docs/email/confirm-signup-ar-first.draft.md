# Confirm signup mail, Arabic first: DRAFT for the owner's approval (register #134)

Not live. Nothing in this repository sends mail: this template lives in the
Supabase dashboard (Authentication → Emails → Templates → "Confirm sign up"),
and only the owner pastes it there. The live template today is Supabase's
default wording with the link switched on 2026-09-28 (#126, #131). "Reset
template" in the dashboard restores Supabase's default, which carries
`{{ .ConfirmationURL }}`, NOT the `token_hash` link. So the rollback for this
change is to paste the link-only version recorded in row #131, not "Reset".

**The link is unchanged, byte for byte, in both places it appears:**

```
{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=signup
```

## Subject

```
أكّد بريدك لتبدأ مع KnowFlow | Confirm your email
```

## Body (paste as the message body, replacing all of it)

```html
<div dir="rtl" lang="ar" style="font-family: Tahoma, Arial, sans-serif; text-align: right; line-height: 1.8; color: #1f1f1f;">
  <h2 style="margin: 0 0 12px;">أهلًا بك في KnowFlow</h2>
  <p style="margin: 0 0 16px;">بقيت خطوة واحدة: أكّد بريدك الإلكتروني، ثم ارفع ملفاتك واسأل عنها.</p>
  <p style="margin: 0 0 16px;">
    <a href="{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=signup"
       style="display: inline-block; padding: 10px 20px; background: #1f1f1f; color: #ffffff; text-decoration: none; border-radius: 8px;">أكّد بريدي</a>
  </p>
  <p style="margin: 0; font-size: 13px; color: #666666;">إذا لم تنشئ حسابًا في KnowFlow، تجاهل هذه الرسالة.</p>
</div>
<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
<div dir="ltr" lang="en" style="font-family: Arial, sans-serif; text-align: left; line-height: 1.6; color: #1f1f1f;">
  <p style="margin: 0 0 12px;"><strong>Welcome to KnowFlow.</strong> One step left: confirm your email, then upload your files and ask about them.</p>
  <p style="margin: 0 0 16px;"><a href="{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=signup">Confirm my email</a></p>
  <p style="margin: 0; font-size: 13px; color: #666666;">If you didn't create a KnowFlow account, you can ignore this email.</p>
</div>
```

## For the owner to rule on

1. **The Arabic wording.** Written in the voice batch 1 set (a young student,
   friendly, مادة/ملفات nouns). "أكّد بريدي" is the button; the ignore line is
   the one sentence a stranger who got this mail by mistake needs.
2. **Both languages in one mail, Arabic first.** A student's language is not
   known to the template today. Row #132's fix would store it in the account's
   metadata; after that, a Go-template condition on `{{ .Data.locale }}` could
   send one language only. Until then, one mail serves both.
3. **Deliverability.** 2026-09-28's reading (inbox, not spam) was taken with
   Supabase's default wording. New wording and a mixed-direction body are a
   new variable: after pasting, send one signup to a fresh plus-address and
   note inbox or spam, as that visit did.
4. **No expiry time is stated** on purpose: the register does not record the
   project's OTP expiry, and a wrong number would be a false promise.

## Optional addition, only once PR #224 (register #132) is live on production

Append `&locale={{ .Data.locale }}` to the link, in BOTH places it appears,
so it reads:

```
{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=signup&locale={{ .Data.locale }}
```

What it does: a link the callback REFUSES (expired, already used) has no user
to read, so without this it opens its notice in the phone's language; with it,
in the student's. A link that succeeds is unchanged, because the callback
prefers the account's stored choice, which is the same value. The callback
drops anything that is not `ar` or `en`, and for an account with no stored
locale the field renders empty and is ignored. The recovery template can take
the same suffix (`&type=recovery&locale={{ .Data.locale }}`).

Do not paste it before PR #224 is deployed: until then the callback ignores
the parameter, which is harmless but does nothing.
