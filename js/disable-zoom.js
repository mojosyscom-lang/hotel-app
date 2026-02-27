// Disable double-tap zoom (mostly iOS)
let lastTouchEnd = 0;
document.addEventListener("touchend", (e)=>{
  const now = Date.now();
  if(now - lastTouchEnd <= 300){
    e.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

// Disable pinch zoom gesture (iOS Safari)
document.addEventListener("gesturestart", (e)=> e.preventDefault());
document.addEventListener("gesturechange", (e)=> e.preventDefault());
document.addEventListener("gestureend", (e)=> e.preventDefault());

// Disable ctrl/cmd + wheel zoom (desktop)
window.addEventListener("wheel", (e)=>{
  if(e.ctrlKey || e.metaKey) e.preventDefault();
}, { passive: false });
