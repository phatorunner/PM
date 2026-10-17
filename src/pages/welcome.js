/* =====================================================================
   WELCOME PAGE: Rotating Daily Bible Verse & Faith Foundation Prompts
   ===================================================================== */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { A } from '../actions/actions.js';
import { getActiveBibleVerse } from '../features/bible-verse.js';
import { PRAYER_STATE, playDailyMorningPrayer } from '../features/gemini-prayer.js';
import { render } from '../shell/render.js';

export const WELCOME_EXAMPLES = [
  {
    id: 'morning-prayer',
    title: 'Morning prayer',
    desc: 'Listen to an uplifting, peaceful prayer generated with Gemini AI',
    prompt: 'Heavenly Father, thank You for the gift of today. Guide my thoughts, bless my hands, and grant me wisdom and diligence in every task I set out to accomplish today. Amen.',
    action: 'prayer',
  },
  {
    id: 'strength-guidance',
    title: 'Strength and focus',
    desc: 'Seek peace and clarity amidst deadlines and complex tasks',
    prompt: 'Lord, grant me strength when weary, clarity in decision-making, and patience through unexpected hurdles.',
    action: 'prayer-text',
  },
  {
    id: 'peace-rest',
    title: 'Peace and restful mind',
    desc: 'Cast all your anxieties upon Him, for He cares for you',
    prompt: 'Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid.',
    action: 'prayer-text',
  },
  {
    id: 'gratitude-journal',
    title: 'Evening thanksgiving',
    desc: 'Give thanks for victories, answered prayers, and growth today',
    prompt: 'Thank You Lord for walking with me through this day and blessing the fruit of our labor.',
    action: 'prayer-text',
  },
];

export function pageWelcome() {
  const verse = getActiveBibleVerse();
  const isPrayerLoading = PRAYER_STATE.isLoading;
  const isPrayerPlaying = PRAYER_STATE.isPlaying;

  return `<div class="page flush" style="display:flex;flex-direction:column;height:100%;min-height:100%;position:relative;background:var(--bg);overflow:hidden">
    <!-- SideRays Background Light Shimmer (React Bits) -->
    <div id="welcome-rays" class="side-rays welcome-rays-bg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></div>

    <!-- Centered Clean Linear-Style View -->
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px var(--gutter);max-width:880px;width:100%;margin:0 auto;position:relative;z-index:1">
      
      <!-- Prominent Rotating Bible Verse (YourVision API) -->
      <a
        href="${esc(verse.url)}"
        target="_blank"
        rel="noopener noreferrer"
        class="agent-verse-headline"
        aria-label="Read ${esc(verse.ref)} on Bible.com"
        style="margin-bottom:36px"
      >
        <h1>“${esc(verse.text)}”</h1>
        <div class="agent-verse-ref">${esc(verse.ref)}</div>
      </a>

      <!-- Curated Example Options / Devotional Cards (Single horizontal row of 4) -->
      ${
        isPrayerPlaying
          ? `<div style="width:100%;margin-bottom:12px;display:flex;justify-content:flex-end"><span class="badge accent" style="display:inline-flex;align-items:center;gap:5px;font-size:11px">${ic('volume-2', 12)}Playing Morning Prayer</span></div>`
          : ''
      }

      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:14px;width:100%">
        ${WELCOME_EXAMPLES.map(ex => {
          const isMorningPrayer = ex.id === 'morning-prayer';
          const cardLoading = isMorningPrayer && isPrayerLoading;
          const cardPlaying = isMorningPrayer && isPrayerPlaying;

          let displayTitle = ex.title;
          let displayDesc = ex.desc;

          if (cardLoading) {
            displayTitle = 'Preparing prayer…';
            displayDesc = 'Generating peaceful audio via Gemini AI Studio…';
          } else if (cardPlaying) {
            displayTitle = 'Playing Morning Prayer';
            displayDesc = 'Listening to today’s peaceful morning prayer…';
          }

          const photoHtml = ex.image
            ? `<img src="${esc(ex.image)}" alt="${esc(displayTitle)}" style="width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.3s ease" />`
            : `<div class="preset-photo-placeholder" style="width:100%;height:100%;background:linear-gradient(145deg, var(--surface-2), var(--surface-3));display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
                <div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 30%, rgba(255,255,255,0.04), transparent 70%)"></div>
              </div>`;

          return `
          <div
            class="example-card ${cardLoading ? 'is-loading' : ''} ${cardPlaying ? 'is-playing' : ''}"
            data-a="openWelcomePrompt"
            data-id="${esc(ex.id)}"
            role="button"
            tabindex="0"
            aria-disabled="${cardLoading}"
            style="width:100%;aspect-ratio:2 / 3;position:relative;background:var(--surface);border:1px solid ${cardPlaying ? 'var(--accent)' : 'var(--border)'};border-radius:14px;overflow:hidden;cursor:${cardLoading ? 'wait' : 'pointer'};display:flex;flex-direction:column;justify-content:flex-end;text-align:left;transition:background var(--dur), border-color var(--dur), transform var(--dur), box-shadow var(--dur);box-shadow:var(--shadow-sm);opacity:${cardLoading ? '0.75' : '1'};pointer-events:${cardLoading ? 'none' : 'auto'}"
            onmouseover="if(!${cardLoading}){this.style.borderColor='var(--border-strong)';this.style.transform='translateY(-3px)';this.style.boxShadow='var(--shadow-pop)'}"
            onmouseout="if(!${cardLoading}){this.style.borderColor='${cardPlaying ? 'var(--accent)' : 'var(--border)'}';this.style.transform='none';this.style.boxShadow='var(--shadow-sm)'}"
          >
            <!-- 2:3 Background Photo / Texture Layer -->
            <div style="position:absolute;inset:0;width:100%;height:100%;z-index:0;overflow:hidden">
              ${photoHtml}
            </div>

            <!-- Dark Gradient Vignette for Text Legibility -->
            <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.05) 80%);z-index:1;pointer-events:none"></div>

            <!-- Loading / Playing Overlays -->
            ${cardLoading ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;color:var(--accent);z-index:3"><span class="spin" style="display:inline-flex">${ic('loader-2', 26)}</span></div>` : ''}
            ${cardPlaying ? `<div style="position:absolute;top:10px;right:10px;background:var(--accent);color:#000;border-radius:20px;padding:3px 8px;font-size:10px;font-weight:700;display:flex;align-items:center;gap:4px;z-index:3">${ic('volume-2', 11)}LIVE</div>` : ''}

            <!-- Text & Subtext Overlaid at the Bottom -->
            <div style="position:relative;z-index:2;padding:14px 12px;display:flex;flex-direction:column;gap:4px">
              <div style="font-size:13.5px;font-weight:600;color:#ffffff;line-height:1.25;text-shadow:0 1px 3px rgba(0,0,0,0.6)">${esc(displayTitle)}</div>
              <div style="font-size:11px;line-height:1.35;color:rgba(255,255,255,0.72);text-shadow:0 1px 2px rgba(0,0,0,0.6)">${esc(displayDesc)}</div>
            </div>
          </div>
        `;
        }).join('')}
      </div>

    </div>
  </div>`;
}

// Action handler for clicking welcome prompt cards
A.openWelcomePrompt = async el => {
  const item = WELCOME_EXAMPLES.find(x => x.id === el.dataset.id);
  if (!item) return;

  if (item.id === 'morning-prayer') {
    // Generate and play audio via Gemini 2.5 Flash
    await playDailyMorningPrayer(() => render());
    return;
  }

  // If user wants to open the Bible verse online
  if (item.action === 'verse') {
    const verse = getActiveBibleVerse();
    if (verse?.url) window.open(verse.url, '_blank', 'noopener,noreferrer');
  } else {
    // Navigate to new task or modal
    A.newTask({ dataset: { title: item.title } });
  }
};
