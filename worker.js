
// Простой парсер устройств из поля формы
function parseDevice(rawDevice = "") {
  const text = rawDevice.toLowerCase();
  let brand = "Інше / Не вказано";
  let series = "";

  if (text.includes("iphone") || text.includes("айфон") || text.includes("ipad") || text.includes("macbook") || text.includes("apple") || text.includes("watch") || text.includes("air") || text.includes("mini")) {
    brand = "Apple 🍏";
    if (text.includes("iphone") || text.includes("айфон")) series = "iPhone";
    else if (text.includes("ipad")) series = "iPad";
    else if (text.includes("macbook")) series = "MacBook";
    else if (text.includes("watch")) series = "Apple Watch";
  } else if (text.includes("samsung") || text.includes("galaxy")) {
    brand = "Samsung 📱";
    series = "Galaxy";
  } else if (text.includes("xiaomi") || text.includes("redmi") || text.includes("poco")) {
    brand = "Xiaomi 📱";
  } else if (text.includes("pixel") || text.includes("google")) {
    brand = "Google 🤖";
    if (text.includes("pixel")) series = "Pixel";
  }

  return { raw: rawDevice, brand, series };
}

// Определитель ОС и браузера по User-Agent
function parseUserAgent(ua = "", touch = 0) {
  let os = "Невідома ОС";
  let browser = "Невідомий браузер";

  if (ua.includes("iPhone") || ua.includes("iPod")) {
    os = "iOS 📱";
  } else if (ua.includes("iPad")) {
    os = "iPadOS 📱";
  } else if (ua.includes("Win")) {
    os = "Windows 🪟";
  } else if (ua.includes("Macintosh") && touch > 1) {
    os = "iPadOS 📱 (режим ПК)";
  } else if (ua.includes("Mac")) {
    os = "macOS 🍏";
  } else if (ua.includes("Android")) {
    os = "Android 🤖";
  } else if (ua.includes("Linux")) {
    os = "Linux 🐧";
  }

  if (ua.includes("Edg/")) browser = "Microsoft Edge";
  else if (ua.includes("Chrome/")) browser = "Google Chrome";
  else if (ua.includes("Safari/")) browser = "Safari";
  else if (ua.includes("Firefox/")) browser = "Mozilla Firefox";

  return { os, browser };
}

// Discord не принимает пустые значения полей и ограничивает длину до 1024
const clip = (v, fallback = "Не вказано") => {
  const s = String(v ?? "").trim();
  return (s || fallback).slice(0, 1000);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Убираем завершающие слеши: "/api/order/" -> "/api/order"
    const path = url.pathname.toLowerCase().replace(/\/+$/, "") || "/";

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Отправка формы в Discord
    if (request.method === "POST" && (path === "/api/order" || path === "/")) {
      try {
        const webhookUrl = env.DISCORD_WEBHOOK_URL;
        if (!webhookUrl) throw new Error("DISCORD_WEBHOOK_URL не налаштований");

        const body = await request.json();
        const client_ip = request.headers.get("cf-connecting-ip") || "Невідомо";
        const userAgentHeader = request.headers.get("user-agent") || "";
        const orderId = "IM-" + Math.random().toString(36).substring(2, 7).toUpperCase();

        const deviceData = parseDevice(body.device || "");
        const clientEnv = parseUserAgent(userAgentHeader, Number(body.touch) || 0);

        const discordMessage = {
          embeds: [{
            title: "🔔 Нова заявка на ремонт!",
            color: 3447003,
            fields: [
              { name: "🆔 ID Замовлення", value: "`" + orderId + "`", inline: true },
              { name: "👤 Ім'я", value: clip(body.name, "Анонім"), inline: true },
              { name: "📞 Телефон", value: "`" + clip(body.phone) + "`", inline: false },
              { name: "📱 Пристрій", value: clip(body.device), inline: false },
              { name: "🏷️ Визначений бренд", value: `${deviceData.brand}${deviceData.series ? ` (${deviceData.series})` : ""}`, inline: false },
              { name: "🛠️ Проблема", value: clip(body.problem), inline: false },
              { name: "💻 ОС клієнта", value: clientEnv.os, inline: true },
              { name: "🌐 Браузер", value: clientEnv.browser, inline: true },
              { name: "📍 IP", value: "`" + client_ip + "`", inline: true }
            ],
            footer: { text: "iMolodec API" }
          }]
        };

        const discordRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(discordMessage)
        });

        if (!discordRes.ok) {
          const details = await discordRes.text().catch(() => "");
          throw new Error("Помилка Discord API: " + discordRes.status + " " + details.slice(0, 200));
        }

        // orderId — для фронтенда, order_id — для совместимости
        return new Response(JSON.stringify({ status: "success", orderId, order_id: orderId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ detail: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Любой другой POST не должен отдавать HTML с кодом 200
    if (request.method === "POST") {
      return new Response(JSON.stringify({ detail: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Главная страница
     return new Response(htmlContent, {
      headers: { ...corsHeaders, "Content-Type": "text/html;charset=UTF-8" },
    });
  }
};
