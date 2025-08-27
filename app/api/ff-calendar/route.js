import * as cheerio from "cheerio";

export async function GET() {
  try {
    const url = "https://www.forexfactory.com/calendar";
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });

    const html = await res.text();
    const $ = cheerio.load(html);

    const events = [];
    let currentDate = "";
    let currentTime = "";
    let currentCurrency = "";

    $("tr.calendar__row").each((i, el) => {
      const dateCell = $(el).find(".calendar__date").text().trim();
      const timeCell = $(el).find(".calendar__time").text().trim();
      const currencyCell = $(el).find(".calendar__currency").text().trim();

      const title = $(el).find(".calendar__event-title").text().trim();
      const actual = $(el).find(".calendar__actual span").text().trim();
      const forecast = $(el).find(".calendar__forecast span").text().trim();
      const previous = $(el).find(".calendar__previous span").text().trim();

      // 📅 parse date naar ISO lokaal
      if (dateCell) {
        const parsed = new Date(dateCell + " " + new Date().getFullYear());
        currentDate = isNaN(parsed.getTime())
          ? dateCell
          : parsed.toLocaleDateString("en-CA"); // YYYY-MM-DD in lokale TZ
      }

      // ⏱️ tijd converteren
      if (timeCell) {
        const lower = timeCell.toLowerCase();
        if (lower.includes("am") || lower.includes("pm")) {
          let [h, m = "0"] = lower.replace(/am|pm/, "").split(":");
          let hours = parseInt(h, 10);
          let minutes = parseInt(m, 10);

          if (lower.includes("pm") && hours !== 12) hours += 12;
          if (lower.includes("am") && hours === 12) hours = 0;

          currentTime = `${String(hours).padStart(2, "0")}:${String(
            minutes
          ).padStart(2, "0")}`;
        } else {
          // Tentative / All Day → neem tekst over
          currentTime = timeCell;
        }
      }

      if (currencyCell) currentCurrency = currencyCell;

      if (title) {
        // Combineer datetime alleen als tijd echt HH:mm is
        let datetime = "";
        if (currentDate && /^\d{2}:\d{2}$/.test(currentTime)) {
          // let op: geen Z suffix → blijft lokale tijd!
          const [year, month, day] = currentDate.split("-");
          datetime = new Date(
            `${year}-${month}-${day}T${currentTime}:00`
          ).toISOString();
        }

        events.push({
          date: currentDate,
          time: currentTime,
          datetime,
          currency: currentCurrency,
          title,
          actual,
          forecast,
          previous,
        });
      }
    });

    // ✅ Filter: alleen USD + belangrijke events
    const patterns = [
      /cpi/i,
      /ppi/i,
      /non[-\s]?farm/i,
      /federal funds rate/i, // vervangt FOMC
      /powell/i,
      /trump/i,
      /unemployment claims/i,
    ];

    const filtered = events.filter(
      (ev) => ev.currency === "USD" && patterns.some((p) => p.test(ev.title))
    );

    return new Response(JSON.stringify(filtered, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Scraper error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
