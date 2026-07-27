/* =========================================================================
   口コミ投稿のお願いページ（review.html）
   お客様が選ばれた項目とご入力になった文章をつなげて下書きを組み立てます。

   ※選択肢は「事実の断片」にとどめ、宣伝文句にしないこと。
   　文章として仕上げるのはお客様ご自身、というたてつけを崩さないでください。
   ========================================================================= */
(function () {
  "use strict";

  var draft = document.getElementById("rv-draft");
  if (!draft) return;

  var episode  = document.getElementById("rv-episode");
  var countNum = document.getElementById("rv-count-num");
  var countTip = document.getElementById("rv-count-tip");
  var copyBtn  = document.getElementById("rv-copy");
  var copied   = document.getElementById("rv-copied");

  // 下書きを手直しされたあとは、自動生成で上書きしない
  var edited = false;

  /* 指定グループで選ばれた項目 ＋ 「その他」の入力を集める */
  function pick(group) {
    var vals = [];
    var boxes = document.querySelectorAll(
      '.rv-chips[data-group="' + group + '"] input[type="checkbox"]'
    );
    Array.prototype.forEach.call(boxes, function (cb) {
      if (cb.checked) vals.push(cb.value);
    });
    var other = document.querySelector('.rv-other[data-group="' + group + '"]');
    if (other) {
      var t = other.value.trim().replace(/[、。\s]+$/, "");
      if (t) vals.push(t);
    }
    return vals;
  }

  function tidy(s) {
    s = (s || "").replace(/\r/g, "").trim();
    if (!s) return "";
    if (!/[。．.!?！？」）)]$/.test(s)) s += "。";
    return s;
  }

  function build() {
    var lines = [];

    var svc = pick("service");
    if (svc.length) {
      lines.push("水戸市の日下部税理士事務所に、" + svc.join("と") + "をお願いしました。");
    }

    var before = pick("before");
    if (before.length) {
      lines.push("お願いする前は、" + before.join("、") + "という状況でした。");
    }

    var good = pick("good");
    if (good.length) {
      lines.push("実際にお願いしてみて、" + good.join("、") + "ところが良かったです。");
    }

    var ep = tidy(episode ? episode.value : "");
    if (ep) lines.push(ep);

    var rec = pick("recommend");
    if (rec.length) {
      lines.push(rec.join("、") + "におすすめしたいです。");
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
    } else if (n > 400) {
      countTip.textContent = "少し長めです。削っても構いません";
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

  /* 入力欄の変化をすべて拾う */
  var watched = document.querySelectorAll(
    '.rv-chips input[type="checkbox"], .rv-other, #rv-episode'
  );
  Array.prototype.forEach.call(watched, function (el) {
    el.addEventListener("change", refresh);
    el.addEventListener("input", refresh);
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
      function fallback() {
        draft.focus();
        draft.select();
        try { document.execCommand("copy"); done(); } catch (e) { /* 手動でコピーしていただく */ }
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
    });
  }

  updateCount();
})();
