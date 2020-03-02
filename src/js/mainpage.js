import onResize from './onresize.js';

onResize.addListener(([width, height]) => {
  const html = document.documentElement;
  html.style.setProperty('--window-width', width + 'px');
  html.style.setProperty('--window-height', height + 'px');
});

document.body.addEventListener('touchmove', function (event) {
  const target = event.target;
  if (target instanceof Element) {
    if (target.matches('.scroll, .scroll *')) {
      return;
    }
  }
  event.preventDefault();
}, { passive: false, useCapture: false });

