/* =========================================================================
   概算相続税シミュレーター（簡易版／詳細版）
   - 相続税の総額（概算）と当事務所の概算報酬を試算します。
   - 財産は法定相続分どおりに取得するものとして相続税を算出します。
   - 生命保険金は「500万円×法定相続人の数」の非課税枠を控除して加算します。
   - 報酬の単価（変更する場合はここを編集）：
       スタンダードプラン基本料金 … baseFee()
       土地評価加算 … 倍率地域 1利用区分 11,000円／路線価地域 1利用区分 55,000円
       非上場株式評価加算 … 1銘柄あたり 110,000円（=11万円）
   ========================================================================= */
(function () {
  "use strict";
  var simple = document.getElementById("calc-simple");
  var detail = document.getElementById("calc-detail");
  var out = document.getElementById("calc-result");
  if (!out || (!simple && !detail)) return;

  /* 直近の試算結果（お問い合わせフォームへ引き継ぐ用） */
  var lastSummary = "";

  /* 相続税の速算表（取得金額・税率・控除額、単位：万円） */
  var brackets = [
    { limit: 1000,     rate: 0.10, ded: 0 },
    { limit: 3000,     rate: 0.15, ded: 50 },
    { limit: 5000,     rate: 0.20, ded: 200 },
    { limit: 10000,    rate: 0.30, ded: 700 },
    { limit: 20000,    rate: 0.40, ded: 1700 },
    { limit: 30000,    rate: 0.45, ded: 2700 },
    { limit: 60000,    rate: 0.50, ded: 4200 },
    { limit: Infinity, rate: 0.55, ded: 7200 }
  ];
  function taxOf(man) {
    for (var i = 0; i < brackets.length; i++) {
      if (man <= brackets[i].limit) {
        var t = man * brackets[i].rate - brackets[i].ded;
        return t > 0 ? t : 0;
      }
    }
    return 0;
  }

  /* スタンダードプラン 基本料金（税込・万円）：遺産総額（万円）に応じて */
  function baseFee(estate) {
    if (estate < 5000)  return 38.5;
    if (estate < 7500)  return 44;
    if (estate < 10000) return 55;
    if (estate < 12500) return 66;
    if (estate < 15000) return 77;
    if (estate < 20000) return 110;
    if (estate < 25000) return 137.5;
    if (estate < 30000) return 165;
    return null; // 3億円〜：別途お見積り
  }
  var FEE_LAND_B = 1.1;  /* 土地評価加算（倍率地域）：1利用区分=11,000円（万円換算1.1） */
  var FEE_LAND_R = 5.5;  /* 土地評価加算（路線価地域）：1利用区分=55,000円（万円換算5.5） */
  var FEE_STOCK = 11;    /* 非上場株式評価加算：1銘柄=110,000円（万円換算11） */
  var INS_EXEMPT_PER_HEIR = 500; /* 生命保険金の非課税枠：500万円×法定相続人の数 */

  function yen(man) { return "¥" + Math.round(man * 10000).toLocaleString("ja-JP"); }
  function manStr(man) { return (Math.round(man * 10) / 10).toLocaleString("ja-JP") + "万円"; }
  function num(id) { var v = parseFloat((document.getElementById(id) || {}).value); return (isNaN(v) || v < 0) ? 0 : v; }
  function intval(id) { var v = parseInt((document.getElementById(id) || {}).value, 10); return (isNaN(v) || v < 0) ? 0 : v; }
  function row(l, v) { return '<div class="calc-row"><span class="clabel">' + l + '</span><span class="cval">' + v + '</span></div>'; }

  /* 共通計算：
       estateBase=生命保険金を除く遺産総額(万円), insurance=生命保険金の受取額(万円),
       landB/landR=土地利用区分数（倍率地域／路線価地域）, stockN=非上場株式銘柄数,
       breakdown=財産の内訳（お問い合わせフォームへ引き継ぐ文字列の配列・詳細版のみ） */
  function compute(estateBase, insurance, spouse, children, landB, landR, stockN, breakdown) {
    if (estateBase <= 0 && insurance <= 0) { return msg("遺産（財産）の金額を入力してください。"); }
    var heirs = (spouse ? 1 : 0) + children;
    if (heirs < 1) { return msg("配偶者の有無、またはお子様の人数をご入力ください。"); }

    /* 生命保険金の非課税枠（500万円×法定相続人の数）を控除して課税価格へ */
    var insExempt = INS_EXEMPT_PER_HEIR * heirs;
    var insDeducted = insurance > 0 ? Math.min(insurance, insExempt) : 0;
    var estate = estateBase + Math.max(0, insurance - insExempt);

    var deduction = 3000 + 600 * heirs;
    var taxable = Math.max(0, estate - deduction);

    var total = 0;
    if (taxable > 0) {
      if (spouse && children > 0) {
        total += taxOf(taxable * 0.5) + taxOf(taxable * 0.5 / children) * children;
      } else if (spouse) {
        total += taxOf(taxable);
      } else {
        total += taxOf(taxable / children) * children;
      }
    }
    var afterSpouse = (spouse && total > 0) ? total * (1 - (children > 0 ? 0.5 : 1.0)) : total;

    /* 概算報酬 */
    var bf = baseFee(estate), feeHtml, fee = null;
    if (bf === null) {
      feeHtml = '<div class="calc-fee"><span class="clabel">当事務所の概算報酬（スタンダードプラン）</span><div class="amount">別途お見積り（遺産3億円〜）</div></div>';
    } else {
      fee = bf + bf * (heirs - 1) * 0.10 + (landB || 0) * FEE_LAND_B + (landR || 0) * FEE_LAND_R + (stockN || 0) * FEE_STOCK;
      feeHtml = '<div class="calc-fee"><span class="clabel">当事務所の概算報酬（スタンダードプラン・税込）</span><div class="amount">' + yen(fee) + '</div></div>';
    }

    /* お問い合わせフォームへ引き継ぐテキストを組み立てる */
    lastSummary =
      "【概算相続税シミュレーターの試算結果】\n" +
      "・遺産の総額（課税価格の合計）：" + manStr(estate) + "\n" +
      (insDeducted > 0 ? "・生命保険金の非課税枠（500万円×" + heirs + "人）：−" + manStr(insDeducted) + " 控除済み\n" : "") +
      (breakdown && breakdown.length ? "・財産の内訳：\n　- " + breakdown.join("\n　- ") + "\n" : "") +
      "・相続人の構成：" + (spouse ? "配偶者あり" : "配偶者なし") + "・お子様" + children + "人（法定相続人" + heirs + "人）\n" +
      "・基礎控除額：" + manStr(deduction) + "\n" +
      (taxable <= 0
        ? "・相続税の総額（概算）：0円（基礎控除の範囲内）\n"
        : "・相続税の総額（概算）：" + yen(total) + "\n" +
          (spouse ? "・配偶者の税額軽減 適用後の目安：" + yen(afterSpouse) + "\n" : "")) +
      (fee === null
        ? "・当事務所の概算報酬：別途お見積り（遺産3億円〜）"
        : "・当事務所の概算報酬（スタンダードプラン・税込）：" + yen(fee)) +
      "\n※上記は概算です。正確な金額は無料相談にて算定します。";

    var html = "";
    html += row("遺産の総額（課税価格の合計）", manStr(estate));
    if (insDeducted > 0) html += row("生命保険金の非課税枠（500万円×" + heirs + "人）を控除", "−" + manStr(insDeducted));
    html += row("法定相続人の数", heirs + "人");
    html += row("基礎控除額", manStr(deduction));
    html += row("課税遺産総額", manStr(taxable));
    if (taxable <= 0) {
      html += '<div class="calc-main"><span class="clabel">相続税の総額（概算）</span><span class="amount">0円 <small>（基礎控除の範囲内のため相続税はかかりません）</small></span></div>';
    } else {
      html += '<div class="calc-main"><span class="clabel">相続税の総額（概算）</span><span class="amount">' + yen(total) + '</span></div>';
      if (spouse) html += row("配偶者の税額軽減を適用した場合の目安", yen(afterSpouse));
    }
    html += feeHtml;
    html += '<div class="calc-cta"><a class="btn btn-accent" href="contact.html"><i class="fa-solid fa-paper-plane"></i> この内容で無料相談する</a></div>';
    out.className = "calc-result";
    out.innerHTML = html;
  }
  function msg(t) { out.className = "calc-result empty"; out.innerHTML = "<p>" + t + "</p>"; }

  /* 「この内容で無料相談する」→ 試算結果をお問い合わせフォームへ引き継ぐ */
  out.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest(".calc-cta a") : null;
    if (!a) return;
    try { sessionStorage.setItem("kskacCalcSummary", lastSummary || ""); } catch (_) {}
  });

  if (simple) simple.addEventListener("submit", function (e) {
    e.preventDefault();
    compute(num("s-estate"), 0, document.querySelector('input[name="s-spouse"]:checked').value === "1", intval("s-children"), 0, 0, 0, null);
  });
  if (detail) detail.addEventListener("submit", function (e) {
    e.preventDefault();
    var estateBase = num("d-land-bv") + num("d-land-rv") + num("d-bldg-v") + num("d-lstock-v") + num("d-stock-v") + num("d-dep-v") + num("d-other-v");
    /* 入力のあった財産だけを内訳としてまとめる（お問い合わせフォームへ引き継ぐ用） */
    var breakdown = [];
    function bd(label, n, unit, v) {
      if (n <= 0 && v <= 0) return;
      var parts = [];
      if (n > 0) parts.push(n + unit);
      if (v > 0) parts.push(manStr(v));
      breakdown.push(label + "：" + parts.join("・"));
    }
    bd("土地（倍率地域）", intval("d-land-bn"), "区分", num("d-land-bv"));
    bd("土地（路線価地域）", intval("d-land-rn"), "区分", num("d-land-rv"));
    bd("建物", intval("d-bldg-n"), "棟", num("d-bldg-v"));
    bd("上場株式・投資信託", intval("d-lstock-n"), "銘柄", num("d-lstock-v"));
    bd("非上場株式", intval("d-stock-n"), "銘柄", num("d-stock-v"));
    bd("預金", intval("d-dep-n"), "口座", num("d-dep-v"));
    bd("生命保険金", intval("d-ins-n"), "社", num("d-ins-v"));
    bd("その他", 0, "", num("d-other-v"));
    compute(estateBase, num("d-ins-v"), document.querySelector('input[name="d-spouse"]:checked').value === "1", intval("d-children"), intval("d-land-bn"), intval("d-land-rn"), intval("d-stock-n"), breakdown);
  });

  /* モード切替（簡易版／詳細版） */
  var modes = document.querySelectorAll(".calc-mode");
  modes.forEach(function (b) {
    b.addEventListener("click", function () {
      modes.forEach(function (x) { x.classList.remove("is-active"); x.setAttribute("aria-selected", "false"); });
      b.classList.add("is-active"); b.setAttribute("aria-selected", "true");
      var m = b.getAttribute("data-mode");
      if (simple) simple.hidden = (m !== "simple");
      if (detail) detail.hidden = (m !== "detail");
      msg("入力して「概算を計算する」を押してください。");
    });
  });
})();

/* =========================================================================
   フローティング表示の開閉（右端の追従ボタン／スマホは下部バー → タップで拡大）
   ========================================================================= */
(function () {
  "use strict";
  var widget = document.getElementById("calc-widget");
  if (!widget) return;
  var fab = widget.querySelector(".calc-fab");
  var overlay = widget.querySelector(".calc-overlay");
  var closeBtn = widget.querySelector(".calc-close");

  function open() {
    widget.classList.add("is-open");
    if (fab) fab.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }
  function close() {
    widget.classList.remove("is-open");
    if (fab) fab.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  if (fab) fab.addEventListener("click", function () {
    widget.classList.contains("is-open") ? close() : open();
  });
  /* ページ内の「シミュレーターで試算」ボタンからも開けるようにする */
  document.querySelectorAll("[data-open-calc]").forEach(function (b) {
    b.addEventListener("click", open);
  });
  if (closeBtn) closeBtn.addEventListener("click", close);
  if (overlay) overlay.addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && widget.classList.contains("is-open")) close();
  });
})();

/* =========================================================================
   実績帯の数字カウントアップ（画面に入ったら 0 → 目標値）
   ========================================================================= */
(function () {
  "use strict";
  var nums = document.querySelectorAll("[data-count]");
  if (!nums.length) return;
  function animate(el) {
    var to = parseInt(el.getAttribute("data-count"), 10) || 0;
    var t0 = null;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / 900, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        animate(en.target);
      });
    }, { threshold: .5 });
    nums.forEach(function (n) { io.observe(n); });
  } else {
    nums.forEach(animate);
  }
})();
