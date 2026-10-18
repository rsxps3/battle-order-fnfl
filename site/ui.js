/* Retire le logo s'il est introuvable (le fichier est copié depuis fnfl.app par install.sh lorsqu'il existe). */
(function () {
  Array.prototype.forEach.call(document.querySelectorAll("img[data-logo]"), function (img) {
    function drop() { img.remove(); }
    if (img.complete && img.naturalWidth === 0) drop(); else img.addEventListener("error", drop);
  });
})();
