// Dedicated entry for the UMD bundle so the browser global `TinyReplay`
// is the API object itself: <script src=...></script> then TinyReplay.init(...).
import TinyReplay from './index';
export default TinyReplay;
