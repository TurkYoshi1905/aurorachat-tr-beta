let timerId = null;

self.onmessage = function (e) {
  if (e.data === 'start') {
    if (timerId !== null) return;
    timerId = setInterval(function () {
      self.postMessage('ping');
    }, 10000);
  } else if (e.data === 'stop') {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }
};
