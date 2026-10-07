// The app's variant of /terms is the web page itself, rendered under
// native/(site)/layout.tsx (no Pricing link). One page, two layouts; see
// native/layout.tsx. Re-export only: nothing may be added here.
export { default } from '@/app/[locale]/(site)/terms/page';
