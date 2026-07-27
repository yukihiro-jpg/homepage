/* =========================================================================
   口コミ投稿のお願いページ（review.html）
   お客様がご入力になった文章をつなげて下書きを組み立てます。
   ※こちらで用意した文例を混ぜないこと。お客様ご自身の言葉だけを使います。
   ========================================================================= */
(function () {
  "use strict";

  var svc   = document.getElementById("rv-service");
  var q1    = document.getElementById("rv-q1");
  var q2    = document.getElementById("rv-q2");
  var q3    = document.getElementById("rv-q3");
  var draft = document.getElementById("rv-draft");
  if (!svc || !draft) return;

  var countNum = document.getElementById("rv-count-num");
  var countTip = document.getElementById("rv-count-tip");
  var copyBtn  = document.getElementById("rv-copy");
  var copied   = document.getElementById("rv-copied");

  // 下書きを手直しされたあとは、自動生成で上書きしない
  var edited = false;

  function tidy(s) {
    s = (s || "").replace(/\r/g, "").trim();
    if (!s) return "";
    // 文末に句点がなければ足す
    if (!/[。．.!?！？」）)]$/.test(s)) s += "。";
    return s;
  }

  function build() {
    var lines = [];
    var s = svc.value;

    if (s) {
      lines.push("水戸市の日下部税理士事務所に、" + s + "をお願いしました。");
    }
    var a1 = tidy(q1.value);
    var a2 = tidy(q2.value);
    var a3 = tidy(q3.value);

    if (a1) lines.push(a1);
    if (a2) lines.push(a2);
    if (a3) {
      // 「〜方」「〜人」で終わっていれば、おすすめの一文に整える
      if (/(方|人|方々|経営者|社長)$/.test(a3.replace(/。$/, ""))) {
        lines.push(a3.replace(/。$/, "") + "におすすめしたいです。");
      } else {
        lines.push(a3);
      }
    }
    return lines.join("\n");
  }

  function updateCount() {
    var n = draft.value.replace(/\s/g, "").length;
    if (countNum) countNum.textContent = String(n);
    if (!countTip) return;
    if (n === 0) {
      countTip.textContent = "";
      countTip.className = "rv-count-tip";
    } else if (n < 60) {
      countTip.textContent = "もう少し詳しいと参考にされやすくなります";
      countTip.className = "rv-count-tip is-short";
    } else {
      countTip.textContent = "読んだ方の参考になる長さです";
      countTip.className = "rv-count-tip is-ok";
    }
  }

  function refresh() {
    if (!edited) draft.value = build();
    updateCount();
  }

  [svc, q1, q2, q3].forEach(function (el) {
    if (!el) return;
    el.addEventListener("input", refresh);
    el.addEventListener("change", refresh);
  });

  draft.addEventListener("input", function () {
    edited = true;
    updateCount();
  });

  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var text = draft.value;
      if (!text.trim()) {
        draft.focus();
        return;
      }
      function done() {
        if (!copied) return;
        copied.hidden = false;
        window.setTimeout(function () { copied.hidden = true; }, 4000);
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
      function fallback() {
        draft.focus();
        draft.select();
        try { document.execCommand("copy"); done(); } catch (e) { /* 手動でコピーしていただく */ }
      }
    });
  }

  updateCount();
})();
