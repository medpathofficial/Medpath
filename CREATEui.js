/* ═══════════════════════════════════════════
   MEDPATH — UI LAYER
   Version: 1.0

   Rendering only. Never calculates. Never writes.
   All logic comes from engines. All writes go through Data Service.

   Contents (across 4 chunks):
   Chunk 1: Dashboard + Session View
   Chunk 2: Topic Card (Study / Revision / Verify)
   Chunk 3: Subjects + Search
   Chunk 4: Progress + Settings + Helpers
═══════════════════════════════════════════ */


/* ═══════════════════════════════════════════
   SECTION 1 — SHARED UI STATE
═══════════════════════════════════════════ */

const UI_STATE = {
  currentPage: "dashboard",
  activeSheet: null,          /* 'topicCard', 'topicList', 'defer', etc. */
  currentTopicId: null,
  currentTopicMode: null,     /* 'study' / 'revision' / 'verify' */
  currentTopicScreen: 1,      /* screen number within flow */
  currentTopicSource: null,   /* 'revision' / 'recovery' / 'study' */
  ratingSelection: null,      /* temporary rating during flow */
  postRatingSelection: null,  /* post-revision rating */
  activeSectionId: null,      /* subjects page section */
  activeSubjectId: null,      /* subjects page subject */
  activeChapterId: null,      /* subjects page chapter */
  searchQuery: "",
  isSubmitting: false         /* C3 debounce guard */
};


/* ═══════════════════════════════════════════
   SECTION 2 — DOM HELPERS
═══════════════════════════════════════════ */

function ui_$(selector) {
  return document.querySelector(selector);
}

function ui_$$(selector) {
  return document.querySelectorAll(selector);
}

function ui_setContent(containerId, html) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = html;
}

function ui_escape(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function ui_show(el) {
  if (el) el.classList.remove("hidden");
}

function ui_hide(el) {
  if (el) el.classList.add("hidden");
}


/* ═══════════════════════════════════════════
   SECTION 3 — PAGE CONTAINER HELPERS
═══════════════════════════════════════════ */

function ui_getPageContent(pageId) {
  const page = document.getElementById("page-" + pageId);
  if (!page) return null;
  return page.querySelector(".page-content");
}

function ui_setPageHTML(pageId, html) {
  const content = ui_getPageContent(pageId);
  if (content) content.innerHTML = html;
}


/* ═══════════════════════════════════════════
   SECTION 4 — RENDER DASHBOARD
═══════════════════════════════════════════ */

function renderDashboard(dashboardModel) {

  if (!dashboardModel) {
    ui_setPageHTML("dashboard", renderDashboardEmpty());
    return;
  }

  const state = dashboardModel.dashboardState;
  const continuity = dashboardModel.continuity;
  const acknowledgment = dashboardModel.acknowledgment;
  const profile = dashboardModel.profile || {};
  const name = profile.name ? ui_escape(profile.name) : "there";

  let html = "";

  /* Greeting */
  html += '<div class="mt-2 mb-4">';
  html += '<h1 class="text-display text-primary">Hi ' + name + '.</h1>';
  html += '</div>';

  /* Session continuity banner takes priority */
  if (continuity && continuity.showContinuity) {
    html += renderContinuityBanner(continuity);
  } else if (state) {
    html += renderDashboardStateBlock(state, dashboardModel);
  }

  /* Exam countdown */
  if (state && state.examCountdown) {
    html += '<div class="text-small text-muted mt-3">' + ui_escape(state.examCountdown) + '</div>';
  }

  /* Last updated */
  if (state && state.state === "active" && state.lastUpdated) {
    html += '<div class="text-tiny text-muted text-center mt-6">' + renderLastUpdated(state.lastUpdated) + '</div>';
  }

  /* Suggestion */
  if (dashboardModel.suggestion) {
    html += renderSuggestionCard(dashboardModel.suggestion);
  }

  /* Consistency acknowledgment */
  if (acknowledgment && acknowledgment.show) {
    html += '<div class="card mt-6"><div class="text-body text-secondary text-center">' + ui_escape(acknowledgment.message) + '</div></div>';
  }

  /* Floating Log Study button */
  html += renderLogStudyButton();

  ui_setPageHTML("dashboard", html);
}

function renderDashboardStateBlock(state, model) {

  let html = '';

  if (state.state === "active") {
    html += '<div class="card">';
    html += '<div class="text-h2 text-primary">' + ui_escape(state.message) + '</div>';
    html += '<button class="btn-primary mt-4" onclick="startSession()">Begin</button>';
    html += '</div>';
    return html;
  }

  if (state.state === "day1" || state.state === "caughtUp") {
    html += '<div class="card">';
    html += '<div class="text-h3 text-primary">' + ui_escape(state.message) + '</div>';
    html += '<div class="text-body text-secondary mt-2">' + ui_escape(state.subMessage) + '</div>';
    html += '</div>';
    return html;
  }

  return html;
}

function renderSuggestionCard(suggestion) {

  if (!suggestion) return "";

  let html = '<div class="card mt-3">';
  html += '<div class="section-label" style="margin-top:0">Suggested topic</div>';
  html += '<div class="text-h3 text-primary">' + ui_escape(suggestion.topicName) + '</div>';
  html += '<div class="breadcrumb">' + ui_escape(suggestion.subjectName || "") + (suggestion.chapterName ? ' · ' + ui_escape(suggestion.chapterName) : "") + '</div>';
  html += '<button class="btn-primary mt-4" onclick="openTopicCard(\'' + ui_escape(suggestion.topicId) + '\', \'study\')">Pick this topic</button>';
  html += '</div>';
  return html;
}

function renderContinuityBanner(continuity) {

  let html = '<div class="card">';
  html += '<div class="text-body text-secondary">' + ui_escape(continuity.message) + '</div>';
  html += '<div class="text-h3 text-primary mt-1">' + ui_escape(continuity.subMessage) + '</div>';
  html += '<button class="btn-primary mt-4" onclick="continueSession()">Continue</button>';
  html += '</div>';
  return html;
}

function renderLastUpdated(isoTimestamp) {

  try {
    const d = new Date(isoTimestamp);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const suffix = hours >= 12 ? "pm" : "am";
    const displayH = ((hours + 11) % 12) + 1;
    if (sameDay) {
      return "Updated today at " + displayH + ":" + minutes + suffix;
    }
    return "Updated " + d.toLocaleDateString();
  } catch (e) {
    return "Updated recently";
  }
}

function renderLogStudyButton() {
  let html = '';
  html += '<button class="fab" aria-label="Log Study" onclick="openLogStudySheet()">';
  html += '<svg class="fab-icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  html += '</button>';
  return html;
}

function renderDashboardEmpty() {
  return '<div class="empty-state"><div class="text-h3 text-primary">Loading...</div></div>';
}


/* ═══════════════════════════════════════════
   SECTION 5 — RENDER SESSION VIEW
═══════════════════════════════════════════ */

function renderSessionView(sessionView) {

  if (!sessionView) {
    return renderEmptySession();
  }

  const hasAny = sessionView.showRevise || sessionView.showVerify || sessionView.showStudy;
  if (!hasAny) {
    return renderEmptySession();
  }

  let html = '';

  /* Header row */
  html += '<div class="flex items-center justify-between mb-4" style="padding: 0 16px;">';
  html += '<div class="text-h2 text-primary">Today</div>';
  html += '<button class="btn-ghost" onclick="closeSessionSheet()">Close</button>';
  html += '</div>';

  html += '<div style="padding: 0 16px;">';

  if (sessionView.showRevise) {
    html += renderSessionCategory("REVISE", sessionView.revise);
  }
  if (sessionView.showVerify) {
    html += renderSessionCategory("VERIFY", sessionView.verify);
  }
  if (sessionView.showStudy) {
    html += renderSessionCategory("NEW", sessionView.study);
  }

  html += '<div class="mt-6">';
  const first = startFirstTopic(sessionView);
  if (first) {
    html += '<button class="btn-primary" onclick="openTopicFromSession(\'' + ui_escape(first.topicId) + '\', \'' + ui_escape(first.source) + '\')">Start First</button>';
  }
  html += '<button class="btn-secondary mt-3" onclick="openAddTopicSheet()">+ Add a Topic</button>';
  html += '</div>';

  html += '</div>';

  return html;
}

function renderSessionCategory(label, topics) {

  let html = '';
  html += '<div class="section-label">' + ui_escape(label) + '</div>';

  for (const topic of topics) {
    const source = ui_escape(topic.source || "study");
    const topicId = ui_escape(topic.topicId);
    html += '<div class="topic-row" onclick="openTopicFromSession(\'' + topicId + '\', \'' + source + '\')">';
    html += '<div class="topic-row-content">';
    html += '<div class="topic-row-name">' + ui_escape(topic.topicName) + '</div>';
    if (topic.reason) {
      html += '<div class="topic-row-reason">' + ui_escape(topic.reason) + '</div>';
    }
    html += '</div>';
    html += '</div>';
  }

  return html;
}

function renderEmptySession() {
  let html = '';
  html += '<div style="padding: 0 16px;">';
  html += '<div class="empty-state">';
  html += '<div class="empty-state-title">Nothing scheduled.</div>';
  html += '<div class="empty-state-body">Want to study something new?</div>';
  html += '<button class="btn-primary mt-4" onclick="openAddTopicSheet()">Pick a Topic</button>';
  html += '</div>';
  html += '</div>';
  return html;
}


/* ═══════════════════════════════════════════
   SECTION 6 — RENDER SESSION END SCREEN
═══════════════════════════════════════════ */

function renderSessionEnd(endData) {

  if (!endData) return "";

  let html = '';
  html += '<div style="padding: 0 16px;">';
  html += '<div class="empty-state">';
  html += '<div class="text-display text-primary">' + ui_escape(endData.message) + '</div>';
  html += '<div class="text-body text-secondary mt-2">' + ui_escape(endData.subMessage) + '</div>';
  html += '</div>';

  if (endData.showRepeatPrompt) {
    html += '<div class="card">';
    html += '<div class="text-body text-primary">' + ui_escape(endData.repeatPromptMessage) + '</div>';
    html += '<button class="btn-primary mt-4" onclick="retryStruggledTopics()">Yes</button>';
    html += '<button class="btn-ghost mt-2" onclick="closeSessionSheet()">No, I\'m done</button>';
    html += '</div>';
  } else {
    html += '<button class="btn-primary mt-4" onclick="closeSessionSheet()">Continue</button>';
  }

  html += '</div>';
  return html;
}


/* ═══════════════════════════════════════════
   SECTION 7 — TOPIC CARD MAIN RENDERER
═══════════════════════════════════════════ */

function renderTopicCard(topicId, mode, source) {

  UI_STATE.currentTopicId = topicId;
  UI_STATE.currentTopicMode = mode;
  UI_STATE.currentTopicSource = source;
  UI_STATE.currentTopicScreen = 1;
  UI_STATE.ratingSelection = null;
  UI_STATE.postRatingSelection = null;
  UI_STATE.isSubmitting = false;

  const curriculumTopic = getCurriculumTopic(topicId);
  if (!curriculumTopic) {
    return renderTopicCardError();
  }

  const topicStates = safeLoad("medpath_topicStates", {});
  const state = topicStates[topicId];

  const modeInfo = determineTopicCardMode(topicId, topicStates);
  const effectiveMode = mode || modeInfo.mode;
  UI_STATE.currentTopicMode = effectiveMode;

  if (effectiveMode === "study") {
    return renderStudyFlow(curriculumTopic, state, modeInfo, 1);
  }
  if (effectiveMode === "revision") {
    return renderRevisionFlow(curriculumTopic, state, modeInfo, 1);
  }
  if (effectiveMode === "verify") {
    return renderVerifyFlow(curriculumTopic, state, modeInfo, 1);
  }

  return renderStudyFlow(curriculumTopic, state, modeInfo, 1);
}


/* ═══════════════════════════════════════════
   SECTION 8 — TOPIC CARD HEADER
═══════════════════════════════════════════ */

function renderTopicCardHeader(curriculumTopic, contextLine) {

  const showHint = shouldShowTopicCardHint();
  if (showHint) markTopicCardHintShown();

  let html = '';
  html += '<div style="padding: 0 16px;">';

  html += '<div class="flex items-center justify-between mb-4">';
  html += '<button class="btn-ghost" onclick="closeActiveSheet()" style="padding-left:0">← Back</button>';
  html += '</div>';

  html += '<div class="text-h1 text-primary">' + ui_escape(curriculumTopic.topicName) + '</div>';
  html += '<div class="breadcrumb">' + ui_escape(curriculumTopic.subjectName) + ' · ' + ui_escape(curriculumTopic.chapterName) + '</div>';

  if (contextLine) {
    html += '<div class="text-small text-muted mt-2">' + ui_escape(contextLine) + '</div>';
  }

  if (showHint) {
    html += '<div class="text-small text-secondary mt-3" id="tc-hint" style="opacity:1; transition: opacity 400ms ease-out;">Study your topic first, then come back and mark it.</div>';
    setTimeout(function() {
      const el = document.getElementById("tc-hint");
      if (el) el.style.opacity = "0";
      setTimeout(function() { if (el && el.parentNode) el.parentNode.removeChild(el); }, 400);
    }, 4000);
  }

  return html;
}

function renderTopicCardFooter(topicId, source) {

  let html = '';
  html += '<div class="mt-6" style="text-align:center; padding-bottom: 24px;">';
  html += '<button class="btn-ghost" onclick="showWhyIsThisHere(\'' + ui_escape(topicId) + '\', \'' + ui_escape(source || "study") + '\')">Why is this here?</button>';
  html += '</div>';
  html += '</div>'; /* close padding wrapper from header */
  return html;
}


/* ═══════════════════════════════════════════
   SECTION 9 — STUDY FLOW
═══════════════════════════════════════════ */

function renderStudyFlow(curriculumTopic, state, modeInfo, screen) {

  if (screen === 1) return renderStudyScreen1(curriculumTopic, modeInfo);
  if (screen === 2) return renderStudyScreen2(curriculumTopic);
  if (screen === 3) return renderStudyScreen3(curriculumTopic);
  return renderStudyScreen1(curriculumTopic, modeInfo);
}

function renderStudyScreen1(curriculumTopic, modeInfo) {

  let html = renderTopicCardHeader(curriculumTopic, null);

  html += '<div class="mt-6">';
  html += '<div class="text-body text-secondary">Study this topic in your textbook or notes. Come back when you\'re done.</div>';
  html += '</div>';

  html += '<div class="mt-6">';
  html += '<button class="btn-primary" onclick="studyGoToUnderstanding()">I\'ve studied this</button>';
  html += '<button class="btn-ghost mt-3" onclick="closeActiveSheet()">Not now</button>';
  html += '</div>';

  html += renderTopicCardFooter(curriculumTopic.topicId, "study");
  return html;
}

function renderStudyScreen2(curriculumTopic) {

  let html = renderTopicCardHeader(curriculumTopic, null);

  html += '<div class="mt-6">';
  html += '<div class="text-h3 text-primary">How well did you understand this topic?</div>';
  html += '</div>';

  html += renderRatingOptions("study-rating");

  html += '<div class="mt-6">';
  html += '<button class="btn-primary" id="study-submit" onclick="submitStudyEvent()">Done</button>';
  html += '</div>';

  html += renderTopicCardFooter(curriculumTopic.topicId, "study");
  return html;
}

function renderStudyScreen3(curriculumTopic) {

  let html = '<div style="padding: 0 16px;">';

  html += '<div class="empty-state">';
  html += '<div class="text-h1 text-primary">Got it.</div>';
  html += '<div class="text-body text-secondary mt-3">' + ui_escape(curriculumTopic.topicName) + ' is now in your revision schedule.</div>';
  html += '</div>';

  html += '<button class="btn-primary" onclick="advanceAfterConfirmation()">Continue</button>';
  html += '</div>';

  return html;
}


/* ═══════════════════════════════════════════
   SECTION 10 — REVISION FLOW
═══════════════════════════════════════════ */

function renderRevisionFlow(curriculumTopic, state, modeInfo, screen) {

  if (screen === 1) return renderRevisionScreen1(curriculumTopic, modeInfo);
  if (screen === 2) return renderRevisionScreen2(curriculumTopic, modeInfo);
  if (screen === 3) return renderRevisionScreen3(curriculumTopic, modeInfo);
  if (screen === 4) return renderRevisionScreen4(curriculumTopic);
  return renderRevisionScreen1(curriculumTopic, modeInfo);
}

function renderRevisionScreen1(curriculumTopic, modeInfo) {

  let html = renderTopicCardHeader(curriculumTopic, modeInfo.contextLine);

  html += '<div class="mt-6">';
  html += '<div class="text-h3 text-primary">Before you revise —</div>';
  html += '<div class="text-body text-secondary mt-1">How much do you remember right now?</div>';
  html += '</div>';

  html += renderRatingOptions("revision-pre-rating");

  html += '<div class="mt-6">';
  html += '<button class="btn-primary" onclick="revisionGoToRevisionSpace()">See my notes</button>';
  html += '<button class="btn-ghost mt-3" onclick="revisionSkipPreRecall()">Skip recall check</button>';
  html += '</div>';

  html += renderTopicCardFooter(curriculumTopic.topicId, "revision");
  return html;
}

function renderRevisionScreen2(curriculumTopic, modeInfo) {

  let html = renderTopicCardHeader(curriculumTopic, modeInfo.contextLine);

  html += '<div class="mt-6">';
  html += '<div class="text-body text-secondary">Go through your notes or textbook now.</div>';
  html += '</div>';

  html += '<div class="mt-6">';
  html += '<button class="btn-primary" onclick="revisionGoToPostRecall()">I\'ve revised this</button>';
  html += '<button class="btn-secondary mt-3" onclick="deferTopicPrompt()">Need more time</button>';
  html += '<button class="btn-ghost mt-3" onclick="deferTopicPrompt()">Skip for now</button>';
  html += '</div>';

  html += renderTopicCardFooter(curriculumTopic.topicId, "revision");
  return html;
}

function renderRevisionScreen3(curriculumTopic, modeInfo) {

  let html = renderTopicCardHeader(curriculumTopic, modeInfo.contextLine);

  html += '<div class="mt-6">';
  html += '<div class="text-h3 text-primary">After revising —</div>';
  html += '<div class="text-body text-secondary mt-1">How much do you remember now?</div>';
  html += '</div>';

  html += renderRatingOptions("revision-post-rating");

  html += '<div class="mt-6">';
  html += '<button class="btn-primary" id="revision-submit" onclick="submitRevisionEvent()">Done</button>';
  html += '</div>';

  html += renderTopicCardFooter(curriculumTopic.topicId, "revision");
  return html;
}

function renderRevisionScreen4(curriculumTopic) {

  let html = '<div style="padding: 0 16px;">';

  html += '<div class="empty-state">';
  html += '<div class="text-h1 text-primary">Revised.</div>';
  html += '<div class="text-body text-secondary mt-3">' + ui_escape(curriculumTopic.topicName) + '</div>';
  html += '</div>';

  html += '<button class="btn-primary" onclick="advanceAfterConfirmation()">Continue</button>';
  html += '</div>';

  return html;
}


/* ═══════════════════════════════════════════
   SECTION 11 — VERIFY FLOW
═══════════════════════════════════════════ */

function renderVerifyFlow(curriculumTopic, state, modeInfo, screen) {

  if (screen === 1) return renderVerifyScreen1(curriculumTopic, modeInfo);
  if (screen === 2) return renderVerifyScreen2(curriculumTopic, modeInfo);
  if (screen === 3) return renderVerifyScreen3(curriculumTopic);
  return renderVerifyScreen1(curriculumTopic, modeInfo);
}

function renderVerifyScreen1(curriculumTopic, modeInfo) {

  let html = renderTopicCardHeader(curriculumTopic, modeInfo.contextLine);

  html += '<div class="mt-6">';
  html += '<div class="text-h3 text-primary">How much do you actually remember?</div>';
  html += '</div>';

  html += renderRatingOptions("verify-rating");

  html += '<div class="mt-6">';
  html += '<button class="btn-primary" onclick="verifyGoToNotes()">Open my notes</button>';
  html += '<button class="btn-ghost mt-3" onclick="closeActiveSheet()">Skip</button>';
  html += '</div>';

  html += renderTopicCardFooter(curriculumTopic.topicId, "recovery");
  return html;
}

function renderVerifyScreen2(curriculumTopic, modeInfo) {

  let html = renderTopicCardHeader(curriculumTopic, modeInfo.contextLine);

  html += '<div class="mt-6">';
  html += '<div class="text-body text-secondary">Go through your notes now.</div>';
  html += '</div>';

  html += '<div class="mt-6">';
  html += '<button class="btn-primary" id="verify-submit" onclick="submitVerifyEvent()">Done — I\'ve checked this</button>';
  html += '</div>';

  html += renderTopicCardFooter(curriculumTopic.topicId, "recovery");
  return html;
}

function renderVerifyScreen3(curriculumTopic) {

  let html = '<div style="padding: 0 16px;">';

  html += '<div class="empty-state">';
  html += '<div class="text-h1 text-primary">Checked.</div>';
  html += '<div class="text-body text-secondary mt-3">' + ui_escape(curriculumTopic.topicName) + ' is now observed.</div>';
  html += '</div>';

  html += '<button class="btn-primary" onclick="advanceAfterConfirmation()">Continue</button>';
  html += '</div>';

  return html;
}


/* ═══════════════════════════════════════════
   SECTION 12 — RATING OPTIONS RENDERER
═══════════════════════════════════════════ */

function renderRatingOptions(groupId) {

  const labels = ["Poor", "Fair", "Good", "Strong"];

  let html = '<div class="rating-options mt-4" data-group="' + ui_escape(groupId) + '">';
  for (let i = 0; i < labels.length; i++) {
    const value = i + 1;
    html += '<button class="rating-option" data-value="' + value + '" onclick="selectRating(\'' + ui_escape(groupId) + '\', ' + value + ')">';
    html += ui_escape(labels[i]);
    html += '</button>';
  }
  html += '</div>';
  return html;
}

function selectRating(groupId, value) {

  const container = document.querySelector('[data-group="' + groupId + '"]');
  if (!container) return;

  const buttons = container.querySelectorAll(".rating-option");
  for (const btn of buttons) {
    if (parseInt(btn.getAttribute("data-value"), 10) === value) {
      btn.classList.add("selected");
    } else {
      btn.classList.remove("selected");
    }
  }

  if (groupId === "revision-post-rating") {
    UI_STATE.postRatingSelection = value;
  } else {
    UI_STATE.ratingSelection = value;
  }
}


/* ═══════════════════════════════════════════
   SECTION 13 — TOPIC CARD FLOW NAVIGATION
═══════════════════════════════════════════ */

function reRenderTopicCardScreen(screen) {

  UI_STATE.currentTopicScreen = screen;
  const curriculumTopic = getCurriculumTopic(UI_STATE.currentTopicId);
  if (!curriculumTopic) return;

  const topicStates = safeLoad("medpath_topicStates", {});
  const state = topicStates[UI_STATE.currentTopicId];
  const modeInfo = determineTopicCardMode(UI_STATE.currentTopicId, topicStates);

  let html;
  if (UI_STATE.currentTopicMode === "study") {
    html = renderStudyFlow(curriculumTopic, state, modeInfo, screen);
  } else if (UI_STATE.currentTopicMode === "revision") {
    html = renderRevisionFlow(curriculumTopic, state, modeInfo, screen);
  } else if (UI_STATE.currentTopicMode === "verify") {
    html = renderVerifyFlow(curriculumTopic, state, modeInfo, screen);
  } else {
    html = renderStudyFlow(curriculumTopic, state, modeInfo, screen);
  }

  ui_setContent("sheet-content", html);
}

function studyGoToUnderstanding() {
  reRenderTopicCardScreen(2);
}

function revisionGoToRevisionSpace() {
  UI_STATE.ratingSelection = UI_STATE.ratingSelection || null;
  reRenderTopicCardScreen(2);
}

function revisionSkipPreRecall() {
  UI_STATE.ratingSelection = null;
  reRenderTopicCardScreen(2);
}

function revisionGoToPostRecall() {
  reRenderTopicCardScreen(3);
}

function verifyGoToNotes() {
  reRenderTopicCardScreen(2);
}


/* ═══════════════════════════════════════════
   SECTION 14 — DEBOUNCED SUBMISSION HANDLERS (C3)
═══════════════════════════════════════════ */

function ui_lockSubmitButton(id) {
  const btn = document.getElementById(id);
  if (btn) {
    btn.classList.add("submitting");
    btn.disabled = true;
  }
}

function ui_unlockSubmitButton(id) {
  const btn = document.getElementById(id);
  if (btn) {
    btn.classList.remove("submitting");
    btn.disabled = false;
  }
}

function submitStudyEvent() {

  if (UI_STATE.isSubmitting) return;

  if (!UI_STATE.ratingSelection) {
    alert("Please rate your understanding first.");
    return;
  }

  UI_STATE.isSubmitting = true;
  ui_lockSubmitButton("study-submit");

  const result = recordStudyEvent(UI_STATE.currentTopicId, UI_STATE.ratingSelection);

  if (result.success) {
    reRenderTopicCardScreen(3);
  } else {
    alert(result.error || "Couldn't save your progress. Please try again.");
    UI_STATE.isSubmitting = false;
    ui_unlockSubmitButton("study-submit");
  }
}

function submitRevisionEvent() {

  if (UI_STATE.isSubmitting) return;

  if (!UI_STATE.postRatingSelection) {
    alert("Please rate your recall first.");
    return;
  }

  UI_STATE.isSubmitting = true;
  ui_lockSubmitButton("revision-submit");

  const result = recordRevisionEvent(
    UI_STATE.currentTopicId,
    UI_STATE.ratingSelection,
    UI_STATE.postRatingSelection
  );

  if (result.success) {
    reRenderTopicCardScreen(4);
  } else {
    alert(result.error || "Couldn't save your progress. Please try again.");
    UI_STATE.isSubmitting = false;
    ui_unlockSubmitButton("revision-submit");
  }
}

function submitVerifyEvent() {

  if (UI_STATE.isSubmitting) return;

  if (!UI_STATE.ratingSelection) {
    alert("Please rate your recall first.");
    return;
  }

  UI_STATE.isSubmitting = true;
  ui_lockSubmitButton("verify-submit");

  const result = recordRevisionEvent(
    UI_STATE.currentTopicId,
    UI_STATE.ratingSelection,
    null
  );

  if (result.success) {
    /* Default understanding for verify-converted topics */
    const states = safeLoad("medpath_topicStates", {});
    const st = states[UI_STATE.currentTopicId];
    if (st && (st.lastUnderstandingScore === null || st.lastUnderstandingScore === undefined)) {
      st.lastUnderstandingScore = 2;
      st.understandingHistory = [2];
      states[UI_STATE.currentTopicId] = st;
      writeTopicStates(states);
    }
    reRenderTopicCardScreen(3);
  } else {
    alert(result.error || "Couldn't save your progress. Please try again.");
    UI_STATE.isSubmitting = false;
    ui_unlockSubmitButton("verify-submit");
  }
}


/* ═══════════════════════════════════════════
   SECTION 15 — WHY IS THIS HERE + FIRST HINT
═══════════════════════════════════════════ */

function showWhyIsThisHere(topicId, source) {

  const topicStates = safeLoad("medpath_topicStates", {});
  const state = topicStates[topicId];
  const text = generateWhyText(topicId, source, state);

  alert(text);
}

function generateWhyText(topicId, source, state) {

  if (source === "study") {
    return "This is a new topic from your schedule.";
  }

  if (source === "recovery") {
    const importedData = safeLoad("medpath_importedData", []);
    const rec = importedData.find(function(r) { return r.topicId === topicId; });
    if (rec) {
      const label = eng_scoreLabel(rec.recallEstimate);
      return "You marked this as studied earlier with " + label + " recall. Time to check what you actually remember.";
    }
    return "You marked this as studied. Time to check what you remember.";
  }

  if (source === "revision") {
    if (!state) return "This topic needs attention.";

    const daysSince = calculateDaysSinceLastInteraction(state);
    if (state.totalRevisions === 0) {
      return "You studied this " + daysSince + " days ago. Time for your first revision.";
    }
    if (state.lastRecallScore === 1) return "Last revised " + daysSince + " days ago. Your recall was poor. Needs urgent attention.";
    if (state.lastRecallScore === 2) return "Last revised " + daysSince + " days ago. Your recall was fair. Worth reviewing.";
    if (state.lastRecallScore === 3) return "Last revised " + daysSince + " days ago. Your recall was good. Keeping it fresh.";
    if (state.lastRecallScore === 4) return "Last revised " + daysSince + " days ago. Your recall was strong. Maintaining it.";
    return "Last revised " + daysSince + " days ago.";
  }

  return "This topic needs attention.";
}

function shouldShowTopicCardHint() {
  const profile = safeLoad("medpath_profile", null);
  if (!profile) return false;
  return profile.hasSeenTopicCardHint !== true;
}

function markTopicCardHintShown() {
  const profile = safeLoad("medpath_profile", null);
  if (!profile) return;
  if (profile.hasSeenTopicCardHint === true) return;
  profile.hasSeenTopicCardHint = true;
  writeProfile(profile);
}


/* ═══════════════════════════════════════════
   SECTION 16 — DEFER SYSTEM UI
═══════════════════════════════════════════ */

function deferTopicPrompt() {

  const topicId = UI_STATE.currentTopicId;
  if (!topicId) return;

  let html = '<div style="padding: 0 16px;">';
  html += '<div class="text-h2 text-primary mb-4">When should this come back?</div>';

  html += '<button class="btn-secondary mt-2" onclick="confirmDefer(\'' + ui_escape(topicId) + '\', \'later_today\')">Later today</button>';
  html += '<button class="btn-secondary mt-2" onclick="confirmDefer(\'' + ui_escape(topicId) + '\', \'tomorrow\')">Tomorrow</button>';
  html += '<button class="btn-secondary mt-2" onclick="confirmDefer(\'' + ui_escape(topicId) + '\', \'weekend\')">This weekend</button>';

  html += '<button class="btn-ghost mt-4" onclick="closeActiveSheet()">Cancel</button>';
  html += '</div>';

  ui_setContent("sheet-content", html);
}

function confirmDefer(topicId, option) {

  const deferrals = loadDeferrals();
  const rule = deferrals[topicId] || { count: 0, nextEligibleAt: null, pausedUntil: null };

  rule.count = (rule.count || 0) + 1;

  const now = new Date();
  let target = new Date();

  if (option === "later_today") {
    target.setHours(18, 0, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    }
  } else if (option === "tomorrow") {
    target.setDate(target.getDate() + 1);
    target.setHours(6, 0, 0, 0);
  } else if (option === "weekend") {
    const daysUntilSat = (6 - target.getDay() + 7) % 7 || 7;
    target.setDate(target.getDate() + daysUntilSat);
    target.setHours(8, 0, 0, 0);
  }

  rule.nextEligibleAt = target.toISOString();
  deferrals[topicId] = rule;
  saveDeferrals(deferrals);

  if (rule.count >= 3) {
    showThreeDeferralsPrompt(topicId);
  } else {
    closeActiveSheet();
  }
}

function showThreeDeferralsPrompt(topicId) {

  const curriculumTopic = getCurriculumTopic(topicId);
  const name = curriculumTopic ? curriculumTopic.topicName : "this topic";

  let html = '<div style="padding: 0 16px;">';
  html += '<div class="text-h2 text-primary mb-3">You\'ve skipped ' + ui_escape(name) + ' a few times.</div>';
  html += '<div class="text-body text-secondary mb-4">Want to keep it in your schedule or remove it for now?</div>';

  html += '<button class="btn-primary" onclick="keepTopicScheduled(\'' + ui_escape(topicId) + '\')">Keep it</button>';
  html += '<button class="btn-destructive mt-3" onclick="removeTopicForNow(\'' + ui_escape(topicId) + '\')">Remove for now</button>';
  html += '</div>';

  ui_setContent("sheet-content", html);
}

function keepTopicScheduled(topicId) {
  const deferrals = loadDeferrals();
  const rule = deferrals[topicId];
  if (rule) {
    rule.count = 0;
    deferrals[topicId] = rule;
    saveDeferrals(deferrals);
  }
  closeActiveSheet();
}

function removeTopicForNow(topicId) {
  const deferrals = loadDeferrals();
  const rule = deferrals[topicId] || { count: 0, nextEligibleAt: null, pausedUntil: null };
  rule.count = 0;
  rule.nextEligibleAt = null;
  rule.pausedUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  deferrals[topicId] = rule;
  saveDeferrals(deferrals);
  closeActiveSheet();
}


/* ═══════════════════════════════════════════
   SECTION 17 — TOPIC CARD ERRORS
═══════════════════════════════════════════ */

function renderTopicCardError() {
  let html = '<div style="padding: 0 16px;">';
  html += '<div class="empty-state">';
  html += '<div class="empty-state-title">Something didn\'t load correctly.</div>';
  html += '<button class="btn-primary mt-4" onclick="closeActiveSheet()">Close</button>';
  html += '</div>';
  html += '</div>';
  return html;
}


/* ═══════════════════════════════════════════
   SECTION 18 — SUBJECTS PAGE (LEVEL 1)
═══════════════════════════════════════════ */

function renderSubjectsPage() {

  const profile = safeLoad("medpath_profile", null);
  if (!profile || !profile.phase) {
    ui_setPageHTML("subjects", renderSubjectsError());
    return;
  }

  const curriculum = loadCurriculum(profile.phase);
  if (!curriculum) {
    ui_setPageHTML("subjects", renderSubjectsError());
    return;
  }

  let html = '';
  html += '<div class="mt-2 mb-6">';
  html += '<h1 class="text-h1 text-primary">Subjects</h1>';
  html += '</div>';

  for (const subject of curriculum.subjects) {
    html += renderSubjectCard(subject);
  }

  ui_setPageHTML("subjects", html);
}

function renderSubjectCard(subject) {

  let html = '<div class="card" onclick="openSubjectBrowser(\'' + ui_escape(subject.subjectId) + '\')">';
  html += '<div class="text-h3 text-primary">' + ui_escape(subject.subjectName) + '</div>';
  html += '</div>';
  return html;
}

function renderSubjectsError() {
  let html = '';
  html += '<div class="empty-state">';
  html += '<div class="empty-state-title">Subjects couldn\'t load.</div>';
  html += '<button class="btn-primary mt-4" onclick="renderSubjectsPage()">Try Again</button>';
  html += '</div>';
  return html;
}


/* ═══════════════════════════════════════════
   SECTION 19 — SUBJECT BROWSER (LEVEL 2)
═══════════════════════════════════════════ */

function openSubjectBrowser(subjectId) {

  const profile = safeLoad("medpath_profile", null);
  if (!profile) return;

  const curriculum = loadCurriculum(profile.phase);
  if (!curriculum) return;

  const subject = curriculum.subjects.find(function(s) { return s.subjectId === subjectId; });
  if (!subject) return;

  UI_STATE.activeSubjectId = subjectId;
  UI_STATE.activeSectionId = subject.sections[0] ? subject.sections[0].sectionId : null;

  renderSubjectBrowser(subject);
}

function renderSubjectBrowser(subject) {

  let html = '';

  html += '<div class="flex items-center mb-4 mt-2">';
  html += '<button class="btn-ghost" onclick="renderSubjectsPage()" style="padding-left:0">← Subjects</button>';
  html += '</div>';

  html += '<h1 class="text-h1 text-primary mb-4">' + ui_escape(subject.subjectName) + '</h1>';

  /* Section switcher */
  html += '<div class="section-switcher">';
  for (const section of subject.sections) {
    const isActive = section.sectionId === UI_STATE.activeSectionId;
    html += '<button class="section-chip' + (isActive ? ' active' : '') + '" onclick="switchSection(\'' + ui_escape(section.sectionId) + '\')">';
    html += ui_escape(section.sectionName);
    html += '</button>';
  }
  html += '</div>';

  /* Chapters for active section */
  const activeSection = subject.sections.find(function(s) { return s.sectionId === UI_STATE.activeSectionId; });
  if (activeSection) {
    html += '<div class="mt-2">';
    for (const chapter of activeSection.chapters) {
      html += renderChapterRow(chapter);
    }
    html += '</div>';
  }

  ui_setPageHTML("subjects", html);
}

function switchSection(sectionId) {

  UI_STATE.activeSectionId = sectionId;

  const profile = safeLoad("medpath_profile", null);
  const curriculum = loadCurriculum(profile.phase);
  const subject = curriculum.subjects.find(function(s) { return s.subjectId === UI_STATE.activeSubjectId; });
  if (subject) renderSubjectBrowser(subject);
}


/* ═══════════════════════════════════════════
   SECTION 20 — CHAPTER LIST (LEVEL 3)
═══════════════════════════════════════════ */

function renderChapterRow(chapter) {

  let html = '<div class="topic-row" onclick="openChapterBottomSheet(\'' + ui_escape(chapter.chapterId) + '\')">';
  html += '<div class="topic-row-content">';
  html += '<div class="topic-row-name">' + ui_escape(chapter.chapterName) + '</div>';
  html += '</div>';
  html += '</div>';
  return html;
}


/* ═══════════════════════════════════════════
   SECTION 21 — TOPIC BOTTOM SHEET (LEVEL 4)
═══════════════════════════════════════════ */

function openChapterBottomSheet(chapterId) {

  const profile = safeLoad("medpath_profile", null);
  if (!profile) return;

  const curriculum = loadCurriculum(profile.phase);
  const chapter = findChapterInCurriculum(chapterId, profile.phase, { [profile.phase]: curriculum });
  if (!chapter) return;

  const topicStates = safeLoad("medpath_topicStates", {});
  const revisionCandidates = runRevisionEngine(topicStates, curriculum);

  let html = '';
  html += '<div style="padding: 0 16px;">';

  html += '<div class="flex items-center justify-between mb-4">';
  html += '<div class="text-h2 text-primary">' + ui_escape(chapter.chapterName) + '</div>';
  html += '<button class="btn-ghost" onclick="closeActiveSheet()">Close</button>';
  html += '</div>';

  for (const topic of chapter.topics) {
    const state = topicStates[topic.topicId];
    const status = determineTopicStatus(topic.topicId, state, revisionCandidates);
    const indicator = getStatusIndicator(status);
    const statusClass = 'status-' + status.replace(/_/g, '-');

    html += '<div class="topic-row" onclick="openTopicCardFromSubjects(\'' + ui_escape(topic.topicId) + '\')">';
    html += '<div class="topic-row-content">';
    html += '<div class="topic-row-name">' + ui_escape(topic.topicName) + '</div>';
    html += '</div>';
    html += '<div class="topic-status-indicator ' + statusClass + '" aria-label="' + status + '">' + indicator + '</div>';
    html += '</div>';
  }

  html += '</div>';

  openBottomSheet("topicList", html);
}

function openTopicCardFromSubjects(topicId) {

  const topicStates = safeLoad("medpath_topicStates", {});
  const modeInfo = determineTopicCardMode(topicId, topicStates);

  const source = modeInfo.mode === "verify" ? "recovery"
                : modeInfo.mode === "revision" ? "revision"
                : "study";

  openTopicCard(topicId, modeInfo.mode, source);
}


/* ═══════════════════════════════════════════
   SECTION 22 — SEARCH PAGE
═══════════════════════════════════════════ */

function renderSearchPage() {

  let html = '';

  html += '<div class="mt-2 mb-4">';
  html += '<h1 class="text-h1 text-primary">Search</h1>';
  html += '</div>';

  html += '<input class="input-field" id="search-input" type="text" placeholder="Search topics, chapters, subjects..." oninput="handleSearchInput(this.value)" value="' + ui_escape(UI_STATE.searchQuery) + '" />';

  html += '<div id="search-results" class="mt-4"></div>';

  ui_setPageHTML("search", html);

  if (UI_STATE.searchQuery && UI_STATE.searchQuery.length >= 2) {
    handleSearchInput(UI_STATE.searchQuery);
  }
}

function handleSearchInput(query) {

  UI_STATE.searchQuery = query || "";
  const results = ui_$("#search-results");
  if (!results) return;

  if (!query || query.trim().length < 2) {
    results.innerHTML = '<div class="text-body text-muted text-center mt-6">Keep typing to search.</div>';
    return;
  }

  const profile = safeLoad("medpath_profile", null);
  if (!profile) {
    results.innerHTML = '';
    return;
  }

  const curriculum = loadCurriculum(profile.phase);
  const topicStates = safeLoad("medpath_topicStates", {});
  const searchResults = runSearchInCurriculum(query.trim(), curriculum, topicStates);

  if (searchResults.length === 0) {
    let html = '<div class="empty-state">';
    html += '<div class="empty-state-title">No topics found for "' + ui_escape(query) + '".</div>';
    html += '<div class="empty-state-body">Try a shorter word or check the spelling.</div>';
    html += '</div>';
    results.innerHTML = html;
    return;
  }

  let html = '';
  for (const r of searchResults) {
    html += renderSearchResult(r);
  }
  results.innerHTML = html;
}

function renderSearchResult(result) {

  let html = '';
  html += '<div class="topic-row" onclick="handleSearchResultTap(\'' + ui_escape(result.resultType) + '\', \'' + ui_escape(result.id) + '\')">';
  html += '<div class="topic-row-content">';
  html += '<div class="topic-row-name">' + ui_escape(result.name) + '</div>';
  if (result.breadcrumb) {
    html += '<div class="topic-row-reason">' + ui_escape(result.breadcrumb) + '</div>';
  }
  html += '</div>';
  html += '</div>';
  return html;
}

function handleSearchResultTap(type, id) {

  if (type === "topic") {
    openTopicCardFromSubjects(id);
    return;
  }
  if (type === "chapter") {
    openChapterBottomSheet(id);
    return;
  }
  if (type === "subject") {
    navigateTo("subjects");
    setTimeout(function() { openSubjectBrowser(id); }, 100);
  }
}


/* ═══════════════════════════════════════════
   SECTION 23 — SEARCH LOGIC (UI-side)
═══════════════════════════════════════════ */

function runSearchInCurriculum(query, curriculum, topicStates) {

  if (!query || query.length < 2) return [];
  if (!curriculum || !curriculum.subjects) return [];

  const q = query.toLowerCase();
  const results = [];

  /* Search topics first */
  for (const subject of curriculum.subjects) {
    for (const section of subject.sections) {
      for (const chapter of section.chapters) {
        for (const topic of chapter.topics) {
          const score = calculateMatchScore(q, topic.topicName.toLowerCase());
          if (score > 0) {
            results.push({
              resultType: "topic",
              id: topic.topicId,
              name: topic.topicName,
              breadcrumb: subject.subjectName + " · " + chapter.chapterName,
              matchScore: score,
              priority: 1,
              importance: topic.importance
            });
          }
        }
      }
    }
  }

  /* Search chapters */
  for (const subject of curriculum.subjects) {
    for (const section of subject.sections) {
      for (const chapter of section.chapters) {
        const score = calculateMatchScore(q, chapter.chapterName.toLowerCase());
        if (score > 0) {
          results.push({
            resultType: "chapter",
            id: chapter.chapterId,
            name: chapter.chapterName,
            breadcrumb: subject.subjectName + " · " + section.sectionName,
            matchScore: score,
            priority: 2
          });
        }
      }
    }
  }

  /* Search subjects */
  for (const subject of curriculum.subjects) {
    const score = calculateMatchScore(q, subject.subjectName.toLowerCase());
    if (score > 0) {
      results.push({
        resultType: "subject",
        id: subject.subjectId,
        name: subject.subjectName,
        breadcrumb: "",
        matchScore: score,
        priority: 3
      });
    }
  }

  results.sort(function(a, b) {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    const wA = IMPORTANCE_WEIGHTS[a.importance] || 10;
    const wB = IMPORTANCE_WEIGHTS[b.importance] || 10;
    return wB - wA;
  });

  return results.slice(0, 20);
}

function calculateMatchScore(query, target) {
  if (!target) return 0;
  if (target === query) return 100;
  if (target.indexOf(query) === 0) return 80;

  const words = target.split(/\s+/);
  for (const word of words) {
    if (word.indexOf(query) === 0) return 60;
  }

  if (target.indexOf(query) >= 0) return 40;
  return 0;
}


/* ═══════════════════════════════════════════
   SECTION 24 — PROGRESS PAGE
═══════════════════════════════════════════ */

function renderProgressPage() {

  const profile = safeLoad("medpath_profile", null);
  if (!profile) {
    ui_setPageHTML("progress", renderProgressHolding());
    return;
  }

  const topicStates      = safeLoad("medpath_topicStates", {});
  const studyEvents      = safeLoad("medpath_studyEvents", []);
  const revisionEvents   = safeLoad("medpath_revisionEvents", []);
  const importedData     = safeLoad("medpath_importedData", []);
  const curriculum       = loadCurriculum(profile.phase);

  const healthReport = runHealthEngine(
    topicStates, studyEvents, revisionEvents, curriculum, profile
  );

  if (!healthReport.ready) {
    ui_setPageHTML("progress", renderProgressHolding(healthReport.message));
    return;
  }

  const revisionCandidates = runRevisionEngine(topicStates, curriculum);
  const recoveryPriorities = runRecoveryEngine(importedData, topicStates, curriculum);

  const examPace = generateExamPaceSignal(
    healthReport.healthScore,
    profile.examDate,
    revisionCandidates.length,
    recoveryPriorities.length
  );

  const backlog = generateBacklogSignal(
    recoveryPriorities.length,
    revisionCandidates.length
  );

  let html = '';

  html += '<div class="mt-2 mb-2">';
  html += '<h1 class="text-h1 text-primary">Progress</h1>';
  html += '</div>';

  /* Health Score */
  html += '<div class="card">';
  html += '<div class="health-score-display">';
  html += '<div class="health-score-number">' + healthReport.healthScore + '</div>';
  html += '<div class="health-score-label">Health Score</div>';
  html += '<div class="mt-3">' + renderRiskBadge(healthReport.riskStatus) + '</div>';
  html += '</div>';

  html += '<div class="text-body text-secondary mt-4">' + ui_escape(healthReport.interpretation) + '</div>';
  html += '</div>';

  /* Vitals */
  html += renderVitalsGrid(healthReport.vitals);

  /* Diagnoses */
  if (healthReport.diagnoses && healthReport.diagnoses.length > 0) {
    html += '<div class="settings-section-label">Diagnoses</div>';
    for (const dx of healthReport.diagnoses) {
      html += '<div class="card">';
      html += '<div class="text-h3 text-primary">' + ui_escape(dx) + '</div>';
      html += '</div>';
    }
  }

  /* Treatment Plans */
  if (healthReport.treatmentPlans && healthReport.treatmentPlans.length > 0) {
    html += '<div class="settings-section-label">Treatment</div>';
    for (const plan of healthReport.treatmentPlans) {
      html += '<div class="card">';
      html += '<div class="text-h3 text-primary">' + ui_escape(plan.diagnosis) + '</div>';
      html += '<div class="text-body text-secondary mt-2">' + ui_escape(plan.treatment) + '</div>';
      html += '</div>';
    }
  }

  /* Exam Pace */
  if (examPace) {
    html += '<div class="settings-section-label">Exam Pace</div>';
    html += '<div class="card">';
    html += '<div class="flex items-center gap-3">';
    html += '<div class="topic-status-indicator" style="color:' + examPaceColor(examPace.signal) + '">●</div>';
    html += '<div class="text-body text-primary">' + ui_escape(examPace.message) + '</div>';
    html += '</div>';
    html += '</div>';
  }

  /* Backlog */
  if (backlog) {
    html += '<div class="settings-section-label">Backlog</div>';
    html += '<div class="card">';
    html += '<div class="text-body text-secondary">' + ui_escape(backlog) + '</div>';
    html += '</div>';
  }

  ui_setPageHTML("progress", html);
}

function renderProgressHolding(message) {
  const text = message || "Keep studying. Your health report will be ready after a few more sessions.";
  let html = '';
  html += '<div class="mt-2 mb-6">';
  html += '<h1 class="text-h1 text-primary">Progress</h1>';
  html += '</div>';
  html += '<div class="empty-state">';
  html += '<div class="empty-state-body">' + ui_escape(text) + '</div>';
  html += '</div>';
  return html;
}

function renderRiskBadge(riskStatus) {
  const cls =
    riskStatus === "Healthy"  ? "risk-healthy"  :
    riskStatus === "Monitor"  ? "risk-monitor"  :
    riskStatus === "At Risk"  ? "risk-at-risk"  :
    "risk-critical";
  return '<span class="risk-badge ' + cls + '">' + ui_escape(riskStatus) + '</span>';
}

function renderVitalsGrid(vitals) {
  let html = '<div class="vitals-grid">';
  html += renderVitalCard("Coverage", vitals.coverage);
  html += renderVitalCard("Retention", vitals.retention);
  html += renderVitalCard("Understanding", vitals.understanding);
  html += renderVitalCard("Consistency", vitals.consistency);
  html += '</div>';
  return html;
}

function renderVitalCard(label, value) {
  let html = '<div class="vital-card">';
  html += '<div class="vital-label">' + ui_escape(label) + '</div>';
  html += '<div><span class="vital-value">' + value + '</span><span class="vital-unit">%</span></div>';
  html += '</div>';
  return html;
}

function examPaceColor(signal) {
  if (signal === "green")  return "#059669";
  if (signal === "yellow") return "#D97706";
  if (signal === "red")    return "#DC2626";
  return "#6B7280";
}


/* ═══════════════════════════════════════════
   SECTION 25 — SETTINGS PAGE
═══════════════════════════════════════════ */

function renderSettingsPage() {

  const profile  = safeLoad("medpath_profile", {}) || {};
  const settings = safeLoad("medpath_settings", createDefaultSettings());

  let html = '';

  html += '<div class="mt-2 mb-6">';
  html += '<h1 class="text-h1 text-primary">Settings</h1>';
  html += '</div>';

  /* PROFILE */
  html += '<div class="settings-section-label" style="margin-top:0">PROFILE</div>';
  html += renderSettingsRow("Name", profile.name || "Not set", "openEditName()");
  html += renderSettingsRow("Phase", phaseNameFor(profile.phase) || "Not set", "openEditPhase()");
  html += renderSettingsRow("College", profile.college || "Not set", "openEditCollege()");
  html += renderSettingsRow("Exam Date", profile.examDate ? formatDate(profile.examDate) : "Not set", "openEditExamDate()");

  /* LEARNING */
  html += '<div class="settings-section-label">LEARNING</div>';
  html += '<div class="card">';
  html += '<div class="text-body text-primary mb-3">Daily Study Load</div>';
  html += renderIntensityChips(settings.studyIntensity || "normal");
  html += '</div>';

  /* NOTIFICATIONS */
  html += '<div class="settings-section-label">NOTIFICATIONS</div>';
  html += '<div class="card">';
  html += '<div class="settings-row" style="border-bottom:none;">';
  html += '<div class="settings-row-label">Enable Notifications</div>';
  html += renderToggle("notifications-toggle", settings.notifications !== false, "toggleNotifications(this.checked)");
  html += '</div>';
  html += '<div class="text-small text-secondary mt-2">When notifications are on, MedPath reminds you when topics need revision. No spam. No streaks.</div>';
  html += '</div>';

  /* APPEARANCE */
  html += '<div class="settings-section-label">APPEARANCE</div>';
  html += '<div class="card">';
  html += '<div class="text-body text-primary mb-3">Theme</div>';
  html += renderThemeChips(settings.theme || "system");
  html += '</div>';

  /* DATA */
  html += '<div class="settings-section-label">DATA</div>';
  html += renderSettingsRow("Export My Data", "→", "handleExportData()");
  html += renderSettingsRow("Import Data", "→", "handleImportData()");
  html += '<div class="text-small text-secondary mt-2">Your data lives on this device. Export regularly to keep a backup.</div>';

  /* ABOUT */
  html += '<div class="settings-section-label">ABOUT</div>';
  html += '<div class="card">';
  html += '<div class="text-h3 text-primary">MedPath</div>';
  html += '<div class="text-small text-muted mt-1">Version 1.0</div>';
  html += '<div class="text-body text-secondary mt-3">The revision system your syllabus was waiting for.</div>';
  html += '<div class="text-body text-secondary mt-2">Built for Indian MBBS students under the NMC curriculum.</div>';
  html += '</div>';

  /* FOUNDER'S NOTE */
  html += '<div class="settings-section-label">A NOTE FROM THE FOUNDER</div>';
  html += '<div class="card">';
  html += '<div class="text-body text-secondary" style="line-height:1.7; white-space:pre-line;">';
  html += 'I built MedPath because I lived the problem.\n\n';
  html += 'You study something. You understand it. You move on.\n\n';
  html += 'Three weeks later — gone.\n\n';
  html += 'Not because you weren\'t smart enough.\nNot because you didn\'t work hard enough.\n\n';
  html += 'Because nobody told you when to come back.\n\n';
  html += 'MedPath fixes that.\n\n';
  html += 'It watches what you\'ve studied.\nIt watches what you\'re forgetting.\nAnd it tells you exactly what to revise — before your brain drops it.\n\n';
  html += 'No analytics. No gamification. No guilt trips.\n\n';
  html += 'Just the right topic at the right moment.\n\n';
  html += 'That\'s the whole idea.\n\n';
  html += '— Founder\nMBBS Student';
  html += '</div>';
  html += '</div>';

  ui_setPageHTML("settings", html);
}

function renderSettingsRow(label, value, onclickAction) {
  let html = '<div class="card" style="padding: 12px 20px;">';
  html += '<div class="settings-row" style="border-bottom:none;" onclick="' + onclickAction + '">';
  html += '<div class="settings-row-label">' + ui_escape(label) + '</div>';
  html += '<div class="settings-row-value">' + ui_escape(value) + '</div>';
  html += '</div>';
  html += '</div>';
  return html;
}

function renderToggle(id, checked, onchange) {
  let html = '<label class="toggle">';
  html += '<input type="checkbox" id="' + ui_escape(id) + '" ' + (checked ? 'checked' : '') + ' onchange="' + onchange + '" />';
  html += '<span class="toggle-slider"></span>';
  html += '</label>';
  return html;
}

function renderIntensityChips(current) {
  const options = [
    { value: "light",  label: "Light",  sub: "5/day"  },
    { value: "normal", label: "Normal", sub: "10/day" },
    { value: "heavy",  label: "Heavy",  sub: "15/day" }
  ];
  let html = '<div class="chip-row">';
  for (const opt of options) {
    const active = opt.value === current ? " active" : "";
    html += '<button class="chip' + active + '" onclick="setIntensity(\'' + opt.value + '\')">';
    html += '<div>' + opt.label + '</div>';
    html += '<div class="chip-sublabel">' + opt.sub + '</div>';
    html += '</button>';
  }
  html += '</div>';
  return html;
}

function renderThemeChips(current) {
  const options = [
    { value: "light",  label: "Light"  },
    { value: "dark",   label: "Dark"   },
    { value: "system", label: "System" }
  ];
  let html = '<div class="chip-row">';
  for (const opt of options) {
    const active = opt.value === current ? " active" : "";
    html += '<button class="chip' + active + '" onclick="setTheme(\'' + opt.value + '\')">';
    html += '<div>' + opt.label + '</div>';
    html += '</button>';
  }
  html += '</div>';
  return html;
}

function phaseNameFor(phase) {
  if (phase === "phase_1")        return "1st Professional";
  if (phase === "phase_2")        return "2nd Professional";
  if (phase === "phase_3_part_1") return "3rd Professional Part 1";
  if (phase === "phase_3_part_2") return "3rd Professional Part 2";
  if (phase === "internship")     return "Rotating Internship";
  if (phase === "post_internship")return "PG Preparation";
  return null;
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch (e) {
    return iso;
  }
}


/* ═══════════════════════════════════════════
   SECTION 26 — SETTINGS ACTION HANDLERS
═══════════════════════════════════════════ */

function setIntensity(value) {
  const settings = safeLoad("medpath_settings", createDefaultSettings());
  settings.studyIntensity = value;
  writeSettings(settings);
  renderSettingsPage();
}

function setTheme(value) {
  const settings = safeLoad("medpath_settings", createDefaultSettings());
  settings.theme = value;
  writeSettings(settings);
  applyTheme(value);
  renderSettingsPage();
}

function toggleNotifications(enabled) {
  const settings = safeLoad("medpath_settings", createDefaultSettings());
  settings.notifications = !!enabled;
  writeSettings(settings);
}

function applyTheme(value) {
  if (value === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else if (value === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function openEditName() {
  const profile = safeLoad("medpath_profile", {}) || {};
  const html = renderTextEditSheet("Name", profile.name || "", function(value) {
    profile.name = (value || "").trim().slice(0, 50);
    writeProfile(profile);
    renderSettingsPage();
  });
  openBottomSheet("editName", html);
}

function openEditCollege() {
  const profile = safeLoad("medpath_profile", {}) || {};
  const html = renderTextEditSheet("College", profile.college || "", function(value) {
    profile.college = (value || "").trim().slice(0, 100);
    writeProfile(profile);
    renderSettingsPage();
  });
  openBottomSheet("editCollege", html);
}

function openEditPhase() {
  const profile = safeLoad("medpath_profile", {}) || {};
  const options = [
    { id: "phase_1",        name: "1st Professional" },
    { id: "phase_2",        name: "2nd Professional" },
    { id: "phase_3_part_1", name: "3rd Professional Part 1" },
    { id: "phase_3_part_2", name: "3rd Professional Part 2" },
    { id: "internship",     name: "Rotating Internship" },
    { id: "post_internship",name: "PG Preparation" }
  ];

  let html = '<div style="padding: 0 16px;">';
  html += '<div class="text-h2 text-primary mb-4">Change Phase</div>';
  html += '<div class="text-body text-secondary mb-4">Your study history will be preserved. Topics from your previous phase will be archived.</div>';

  for (const opt of options) {
    const active = opt.id === profile.phase ? " selected" : "";
    html += '<button class="rating-option' + active + '" onclick="confirmPhaseChange(\'' + opt.id + '\')">' + opt.name + '</button>';
  }

  html += '<button class="btn-ghost mt-4" onclick="closeActiveSheet()">Cancel</button>';
  html += '</div>';

  openBottomSheet("editPhase", html);
}

function confirmPhaseChange(newPhase) {
  const profile = safeLoad("medpath_profile", {}) || {};
  const oldPhase = profile.phase;
  if (oldPhase === newPhase) { closeActiveSheet(); return; }

  archivePreviousPhaseTopics(oldPhase, newPhase);
  restoreArchivedTopics(newPhase);

  profile.phase = newPhase;
  writeProfile(profile);

  closeActiveSheet();
  renderSettingsPage();
}

function openEditExamDate() {

  const profile = safeLoad("medpath_profile", {}) || {};
  const current = profile.examDate ? profile.examDate.slice(0, 10) : "";

  let html = '<div style="padding: 0 16px;">';
  html += '<div class="text-h2 text-primary mb-4">Exam Date</div>';
  html += '<input class="input-field" type="date" id="exam-date-input" value="' + ui_escape(current) + '" />';
  html += '<div id="exam-date-error" class="error-text hidden">That date has already passed. Please choose a future date.</div>';

  html += '<button class="btn-primary mt-4" onclick="saveExamDate()">Save</button>';
  html += '<button class="btn-secondary mt-3" onclick="clearExamDate()">Clear Date</button>';
  html += '<button class="btn-ghost mt-3" onclick="closeActiveSheet()">Cancel</button>';
  html += '</div>';

  openBottomSheet("editExamDate", html);
}

function saveExamDate() {
  const input = document.getElementById("exam-date-input");
  const errorEl = document.getElementById("exam-date-error");
  if (!input) return;

  const value = input.value;
  if (!value) {
    closeActiveSheet();
    return;
  }

  const chosen = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (chosen <= today) {
    if (errorEl) errorEl.classList.remove("hidden");
    return;
  }

  const profile = safeLoad("medpath_profile", {}) || {};
  profile.examDate = value;
  writeProfile(profile);
  closeActiveSheet();
  renderSettingsPage();
}

function clearExamDate() {
  const profile = safeLoad("medpath_profile", {}) || {};
  profile.examDate = null;
  writeProfile(profile);
  closeActiveSheet();
  renderSettingsPage();
}

function renderTextEditSheet(label, currentValue, onSaveCallback) {

  const inputId = "edit-input-" + Math.random().toString(36).slice(2, 8);

  window._pendingTextSave = onSaveCallback;

  let html = '<div style="padding: 0 16px;">';
  html += '<div class="text-h2 text-primary mb-4">' + ui_escape(label) + '</div>';
  html += '<input class="input-field" id="' + inputId + '" type="text" value="' + ui_escape(currentValue) + '" />';
  html += '<button class="btn-primary mt-4" onclick="commitTextEdit(\'' + inputId + '\')">Save</button>';
  html += '<button class="btn-ghost mt-3" onclick="closeActiveSheet()">Cancel</button>';
  html += '</div>';

  return html;
}

function commitTextEdit(inputId) {
  const input = document.getElementById(inputId);
  const cb = window._pendingTextSave;
  const value = input ? input.value : "";
  closeActiveSheet();
  if (typeof cb === "function") cb(value);
  window._pendingTextSave = null;
}


/* ═══════════════════════════════════════════
   SECTION 27 — EXPORT / IMPORT UI
═══════════════════════════════════════════ */

function handleExportData() {
  const topicStates = safeLoad("medpath_topicStates", {});
  const hasAny = Object.keys(topicStates).length > 0;

  if (!hasAny) {
    alert("Nothing to export yet. Study a few topics first.");
    return;
  }
  exportAllData();
}

function handleImportData() {

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      const contents = evt.target.result;
      showImportConfirm(contents);
    };
    reader.readAsText(file);
  };
  input.click();
}

function showImportConfirm(jsonString) {

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    alert("This backup file couldn't be read. Make sure you are using a MedPath backup file.");
    return;
  }

  const date = parsed.exportDate || "unknown date";

  let html = '<div style="padding: 0 16px;">';
  html += '<div class="text-h2 text-primary mb-3">Restore backup?</div>';
  html += '<div class="text-body text-secondary mb-4">This will restore your data from ' + ui_escape(date) + '. Current data will be replaced.</div>';

  html += '<button class="btn-primary" onclick="confirmImport()">Restore</button>';
  html += '<button class="btn-ghost mt-3" onclick="closeActiveSheet()">Cancel</button>';
  html += '</div>';

  window._pendingImportData = jsonString;
  openBottomSheet("importConfirm", html);
}

function confirmImport() {
  const data = window._pendingImportData;
  window._pendingImportData = null;
  closeActiveSheet();

  if (!data) return;

  const result = importAllData(data);
  if (result.success) {
    location.reload();
  } else {
    alert(result.error || "Restore failed.");
  }
}


/* ═══════════════════════════════════════════
   SECTION 28 — BOTTOM SHEET SYSTEM
═══════════════════════════════════════════ */

function openBottomSheet(sheetId, html) {
  UI_STATE.activeSheet = sheetId;
  ui_setContent("sheet-content", html);

  const sheet   = document.getElementById("bottom-sheet");
  const overlay = document.getElementById("sheet-overlay");

  if (overlay) {
    overlay.classList.remove("hidden");
    setTimeout(function() { overlay.classList.add("visible"); }, 10);
  }
  if (sheet) {
    sheet.classList.remove("closing");
    setTimeout(function() { sheet.classList.add("open"); }, 10);
  }
}

function closeActiveSheet() {

  const sheet   = document.getElementById("bottom-sheet");
  const overlay = document.getElementById("sheet-overlay");

  if (sheet) {
    sheet.classList.remove("open");
    sheet.classList.add("closing");
  }
  if (overlay) {
    overlay.classList.remove("visible");
  }
  setTimeout(function() {
    if (overlay) overlay.classList.add("hidden");
    if (sheet)   sheet.classList.remove("closing");
    UI_STATE.activeSheet = null;
    UI_STATE.currentTopicId = null;
    UI_STATE.currentTopicMode = null;
    UI_STATE.currentTopicScreen = null;
    UI_STATE.currentTopicSource = null;
    UI_STATE.ratingSelection = null;
    UI_STATE.postRatingSelection = null;
    UI_STATE.isSubmitting = false;
  }, 250);
}


/* ═══════════════════════════════════════════
   SECTION 29 — TOPIC CARD OPENERS
═══════════════════════════════════════════ */

function openTopicCard(topicId, forcedMode, source) {
  const html = renderTopicCard(topicId, forcedMode || null, source || "study");
  openBottomSheet("topicCard", html);
}

function openTopicFromSession(topicId, source) {
  const topicStates = safeLoad("medpath_topicStates", {});
  const modeInfo = determineTopicCardMode(topicId, topicStates);
  openTopicCard(topicId, modeInfo.mode, source || "study");
}


/* ═══════════════════════════════════════════
   SECTION 30 — LOG STUDY SHEET
═══════════════════════════════════════════ */

function openLogStudySheet() {

  const profile = safeLoad("medpath_profile", null);
  if (!profile) { alert("Please complete onboarding first."); return; }

  let html = '<div style="padding: 0 16px;">';
  html += '<div class="flex items-center justify-between mb-4">';
  html += '<div class="text-h2 text-primary">Log Study</div>';
  html += '<button class="btn-ghost" onclick="closeActiveSheet()">Close</button>';
  html += '</div>';

  html += '<input class="input-field mb-4" type="text" id="log-study-search" placeholder="Search any topic..." oninput="handleLogStudySearch(this.value)" />';

  html += '<div id="log-study-results"></div>';
  html += '</div>';

  openBottomSheet("logStudy", html);
}

function handleLogStudySearch(query) {

  const results = document.getElementById("log-study-results");
  if (!results) return;

  if (!query || query.trim().length < 2) {
    results.innerHTML = '<div class="text-body text-muted text-center mt-4">Keep typing to search.</div>';
    return;
  }

  const profile = safeLoad("medpath_profile", null);
  if (!profile) return;

  const curriculum = loadCurriculum(profile.phase);
  const topicStates = safeLoad("medpath_topicStates", {});
  const searchResults = runSearchInCurriculum(query.trim(), curriculum, topicStates)
    .filter(function(r) { return r.resultType === "topic"; });

  if (searchResults.length === 0) {
    results.innerHTML = '<div class="text-body text-muted text-center mt-4">No topics found.</div>';
    return;
  }

  let html = '';
  for (const r of searchResults) {
    html += '<div class="topic-row" onclick="openTopicCardFromSubjects(\'' + ui_escape(r.id) + '\')">';
    html += '<div class="topic-row-content">';
    html += '<div class="topic-row-name">' + ui_escape(r.name) + '</div>';
    if (r.breadcrumb) {
      html += '<div class="topic-row-reason">' + ui_escape(r.breadcrumb) + '</div>';
    }
    html += '</div>';
    html += '</div>';
  }
  results.innerHTML = html;
}


/* ═══════════════════════════════════════════
   SECTION 31 — SESSION SHEET
═══════════════════════════════════════════ */

function openSessionSheet(sessionView) {
  const html = renderSessionView(sessionView);
  openBottomSheet("session", html);
}

function closeSessionSheet() {
  closeActiveSheet();
}

function openAddTopicSheet() {
  openLogStudySheet();
}


/* ═══════════════════════════════════════════
   SECTION 32 — POST-CONFIRMATION ADVANCE
═══════════════════════════════════════════ */

function advanceAfterConfirmation() {
  /* app.js will orchestrate what happens next.
     For now: close sheet and refresh dashboard. */
  closeActiveSheet();
  if (typeof refreshDashboard === "function") {
    refreshDashboard();
  }
}


/* ═══════════════════════════════════════════
   SECTION 33 — SESSION START / CONTINUE
═══════════════════════════════════════════ */

function startSession() {
  if (typeof buildAndOpenSession === "function") {
    buildAndOpenSession();
  }
}

function continueSession() {
  if (typeof buildAndOpenSession === "function") {
    buildAndOpenSession();
  }
}

function retryStruggledTopics() {
  /* Placeholder — full implementation in app.js orchestration */
  closeActiveSheet();
}
