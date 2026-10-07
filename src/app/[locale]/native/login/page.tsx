// The app's variant of /login is the web page itself, rendered under
// native/layout.tsx, whose PlatformProvider hides the Google button. One page,
// two layouts; re-export only: nothing may be added here.
export { default } from '@/app/[locale]/login/page';
