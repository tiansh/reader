import Router from './router.js';
import ListPage from './listpage.js';
import ReadPage from './readpage.js';
import './mainpage.js';

const router = new Router({
  list: new ListPage(),
  read: new ReadPage(),
}, '/');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

