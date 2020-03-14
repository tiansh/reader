import Router from './router.js';
import ListPage from './listpage.js';
import ReadPage from './readpage.js';
import ConfigPage from './configpage.js';
import './mainpage.js';

const router = new Router({
  list: new ListPage(),
  read: new ReadPage(),
  config: new ConfigPage(),
}, '/');

; (async function () {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.register('./sw.js');
    registration.update();
  }
}());

