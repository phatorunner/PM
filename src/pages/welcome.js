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
    title: 'Start with morning prayer',
    desc: 'Listen to an uplifting, peaceful prayer generated with Gemini AI',
    icon: 'sunrise',
    prompt: 'Heavenly Father, thank You for the gift of today. Guide my thoughts, bless my hands, and grant me wisdom and diligence in every task I set out to accomplish today. Amen.',
    action: 'prayer',
  },
  {
    id: 'scripture-reflection',
    title: 'Daily scripture meditation',
    desc: 'Reflect deeply on God’s promises and today’s verse',
    icon: 'book-open',
    prompt: 'How can I apply today’s verse to my daily challenges and interactions with others?',
    action: 'verse',
  },
  {
    id: 'strength-guidance',
    title: 'Prayer for strength & focus',
    desc: 'Seek peace and clarity amidst deadlines and complex tasks',
    icon: 'shield',
    prompt: 'Lord, grant me strength when weary, clarity in decision-making, and patience through unexpected hurdles.',
    action: 'prayer-text',
  },
  {
    id: 'gratitude-journal',
    title: 'Evening thanksgiving',
    desc: 'Give thanks for victories, answered prayers, and growth today',
    icon: 'sunset',
    prompt: 'Thank You Lord for walking with me through this day and blessing the fruit of our labor.',
    action: 'prayer-text',
  },
  {
    id: 'work-excellence',
    title: 'Heart for excellence',
    desc: 'Commit to doing all things heartily as unto the Lord',
    icon: 'compass',
    prompt: 'Whatever you do, work at it with all your heart, as working for the Lord, not for human masters.',
    action: 'verse',
  },
  {
    id: 'peace-rest',
    title: 'Peace & restful mind',
    desc: 'Cast all your anxieties upon Him, for He cares for you',
    icon: 'heart',
    prompt: 'Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid.',
    action: 'verse',
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
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px var(--gutter);max-width:760px;width:100%;margin:0 auto;position:relative;z-index:1">
      
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

      <!-- 6 Curated Example Options / Devotional Cards -->
      <div style="width:100%;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
        <span class="faint" style="font-size:12px;font-weight:500;letter-spacing:0.02em">Get started with prayer and reflection</span>
        ${
          isPrayerPlaying
            ? `<span class="badge accent" style="display:inline-flex;align-items:center;gap:5px;font-size:11px">${ic('volume-2', 12)}Playing Morning Prayer</span>`
            : ''
        }
      </div>

      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:12px;width:100%">
        ${WELCOME_EXAMPLES.map(ex => {
          const isMorningPrayer = ex.id === 'morning-prayer';
          const cardLoading = isMorningPrayer && isPrayerLoading;
          const cardPlaying = isMorningPrayer && isPrayerPlaying;

          let displayTitle = ex.title;
          let displayDesc = ex.desc;
          let displayIcon = ex.icon;

          if (cardLoading) {
            displayTitle = 'Preparing prayer…';
            displayDesc = 'Generating peaceful audio via Gemini AI Studio…';
            displayIcon = 'loader-2';
          } else if (cardPlaying) {
            displayTitle = 'Playing Morning Prayer';
            displayDesc = 'Listening to today’s peaceful morning prayer…';
            displayIcon = 'volume-2';
          }

          return `
          <div
            class="example-card ${cardLoading ? 'is-loading' : ''} ${cardPlaying ? 'is-playing' : ''}"
            data-a="openWelcomePrompt"
            data-id="${esc(ex.id)}"
            role="button"
            tabindex="0"
            aria-disabled="${cardLoading}"
            style="background:var(--surface);border:1px solid ${cardPlaying ? 'var(--accent)' : 'var(--border)'};border-radius:10px;padding:16px;cursor:${cardLoading ? 'wait' : 'pointer'};display:flex;flex-direction:column;gap:8px;text-align:left;transition:background var(--dur), border-color var(--dur);box-shadow:var(--shadow-sm);opacity:${cardLoading ? '0.75' : '1'};pointer-events:${cardLoading ? 'none' : 'auto'}"
            onmouseover="if(!${cardLoading}){this.style.borderColor='var(--border-strong)';this.style.background='var(--surface-2)'}"
            onmouseout="if(!${cardLoading}){this.style.borderColor='${cardPlaying ? 'var(--accent)' : 'var(--border)'}';this.style.background='var(--surface)'}"
          >
            <div style="color:var(--accent);display:flex;align-items:center;gap:6px">
              <span class="${cardLoading ? 'spin' : ''}" style="display:inline-flex">${ic(displayIcon, 16)}</span>
            </div>
            <div style="font-size:13.5px;font-weight:600;color:var(--text);line-height:1.3">${esc(displayTitle)}</div>
            <div class="faint" style="font-size:11.5px;line-height:1.4">${esc(displayDesc)}</div>
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
