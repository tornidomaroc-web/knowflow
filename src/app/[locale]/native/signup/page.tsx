// The app's variant of /signup is the web page itself, rendered under
// native/layout.tsx, whose PlatformProvider hides the Google button. One page,
// two layouts; re-export only: nothing may be added here.
export { default } from '@/app/[locale]/signup/page';
