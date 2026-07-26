/* =========================================================================
   日下部税理士事務所 ─ 共通スクリプト（最小限）
   - モバイルメニューの開閉
   - スクロール時のヘッダー影
   - スクロールに合わせた要素のフェード表示
   - フッターの年号自動更新
   ========================================================================= */
(function () {
  "use strict";

  // JS が有効なことを示すクラス（CSS のフェード表示はこれが付いた時だけ働く）
  document.documentElement.classList.add("js");

  /* --- モバイルメニュー開閉 --- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");

  if (toggle && nav) {
    var closeMenu = function () {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "メニューを開く");
    };
    var openMenu = function () {
      nav.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "メニューを閉じる");
    };

    toggle.addEventListener("click", function () {
      if (nav.classList.contains("is-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // メニュー内のリンクを押したら閉じる
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    // Esc キーで閉じる
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });

    // 画面を広げたら状態をリセット
    window.addEventListener("resize", function () {
      if (window.innerWidth > 860) closeMenu();
    });
  }

  /* --- スクロールでヘッダーに影を付ける --- */
  var header = document.getElementById("site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* --- スクロールでふわっと表示（対応ブラウザのみ） --- */
  var revealTargets = document.querySelectorAll("[data-reveal]");
  if (revealTargets.length && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    revealTargets.forEach(function (el) { observer.observe(el); });
  } else {
    // 非対応環境ではそのまま表示
    revealTargets.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* --- お問い合わせ：シミュレーター試算結果を「シミュレーション結果」欄へ引き継ぐ --- */
  /*     （お問い合わせ内容の欄はご相談内容の記入用として空欄のまま残す）        */
  var calcResultField = document.getElementById("calc-result-field");
  if (calcResultField) {
    try {
      var calcSummary = sessionStorage.getItem("kskacCalcSummary");
      if (calcSummary) {
        calcResultField.value = calcSummary;
        var wrap = document.getElementById("calc-result-wrap");
        if (wrap) wrap.hidden = false;
        var inheritRadio = document.querySelector('input[name="お問い合わせ項目"][value="相続税申告"]');
        if (inheritRadio) inheritRadio.checked = true;
        sessionStorage.removeItem("kskacCalcSummary");
      }
    } catch (_) {}
  }

  /* --- お問い合わせ：通知メールをコンパクトにする -------------------------
     入力欄は細かく分かれているが、送信直前に「会社名＋姓＋名」「せい＋めい」
     「希望日時（第一＋第二）」をそれぞれ1項目にまとめ、Netlify に登録された
     hidden 項目（お名前／ふりがな／ご希望日時）へ値を入れる。細切れの入力欄は
     name を持たない（＝メールに出ない）ので、通知メールは短く読みやすくなる。
     万一エラーが起きても try/catch で通常送信にフォールバックする。 */
  var contactForm = document.querySelector('form[name="contact"]');
  if (contactForm) {
    var contactPacked = false;
    contactForm.addEventListener("submit", function () {
      if (contactPacked) return;
      try {
        var byId = function (id) {
          var el = document.getElementById(id);
          return el && el.value ? el.value.trim() : "";
        };
        var setHidden = function (n, v) {
          var el = contactForm.querySelector('input[type="hidden"][name="' + n + '"]');
          if (el) el.value = v;
        };
        var range = function (dId, sId, eId) {
          var d = byId(dId), s = byId(sId), e = byId(eId);
          if (!d && !s && !e) return "";
          var t = s && e ? s + "〜" + e : s ? s + "〜" : e ? "〜" + e : "";
          return (d + (t ? " " + t : "")).trim();
        };

        // お名前（会社名があれば併記）／ふりがな
        var nm = (byId("name-last") + "　" + byId("name-first")).trim();
        var company = byId("company");
        setHidden("お名前", company ? nm + "（" + company + "）" : nm);
        setHidden("ふりがな", (byId("kana-last") + "　" + byId("kana-first")).trim());

        // ご希望日時（第一＋第二を1項目に）
        var p1 = range("p1-date", "p1-start", "p1-end");
        var p2 = range("p2-date", "p2-start", "p2-end");
        setHidden("ご希望日時", p2 ? p1 + "　／　第2希望：" + p2 : p1);

        // 相続シミュレーションの試算結果があれば、お問い合わせ内容の先頭にまとめる
        var calc = byId("calc-result-field");
        if (calc) {
          var msg = contactForm.querySelector('textarea[name="お問い合わせ内容"]');
          if (msg) {
            var base = msg.value ? msg.value.trim() : "";
            msg.value = "【概算相続税シミュレーション結果】\n" + calc +
                        (base ? "\n\n――――――――――\n" + base : "");
          }
        }

        contactPacked = true;
      } catch (_) {
        /* 失敗時はそのまま通常送信（入力は失われない） */
      }
    });
  }

  /* --- ページ内目次：スクロール追従ハイライト＋ワイド画面の縦型レール表示 --- */
  var toc = document.querySelector(".page-toc");
  if (toc && "IntersectionObserver" in window) {
    var tocMap = {};
    toc.querySelectorAll('a[href^="#"]').forEach(function (a) {
      var id = a.getAttribute("href").slice(1);
      if (document.getElementById(id)) tocMap[id] = a;
    });
    var tocLinks = toc.querySelectorAll("a");
    var tocIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        tocLinks.forEach(function (l) { l.classList.remove("is-active"); });
        if (tocMap[en.target.id]) tocMap[en.target.id].classList.add("is-active");
      });
    }, { rootMargin: "-42% 0px -53% 0px", threshold: 0 });
    Object.keys(tocMap).forEach(function (id) { tocIO.observe(document.getElementById(id)); });

    /* ヒーローが見えている間は縦型レールを隠す（1600px以上でのみ効くCSSと連動） */
    var pageHero = document.querySelector(".page-hero, .hero");
    if (pageHero) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { toc.classList.toggle("is-shown", !en.isIntersecting); });
      }, { rootMargin: "-70px 0px 0px 0px", threshold: 0 }).observe(pageHero);
    } else {
      toc.classList.add("is-shown");
    }
  }

  /* --- フッターの年号を自動更新 --- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
