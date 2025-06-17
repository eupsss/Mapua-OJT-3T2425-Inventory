// rooms1.js – adds searchable “Log Fix” flow without technician filter
// -----------------------------------------------------------------------------
console.log("▶️ rooms1.js loaded");

/*************************************************
 * 1)  Convenience helpers
 *************************************************/
const $  = (sel) => document.querySelector(sel);
const todayISO = () => new Date().toISOString().split("T")[0];

/*************************************************
 * 2)  Cached DOM references
 *************************************************/
const fixModal   = $("#fixModal");
const fixForm    = $("#fixForm");
const fixDate    = $("#fixDate");
const fixerInput = $("#fixerInput");
const fixerList  = $("#fixerList");
const fixCancel  = $("#fixCancel");

/*************************************************
 * 3)  User roster (all registered users ≙ potential fixers)
 *************************************************/
let userRoster = [];
async function loadUsers() {
  try {
    const res = await fetch("../api/users.php"); // returns every user
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    userRoster = await res.json(); // [{ userId, fullName }, …]

    fixerList.innerHTML = userRoster
      .map(u => `<option value="${u.fullName}" data-id="${u.userId}">`)
      .join("");
  } catch (err) {
    console.error(err);
    alert("Unable to load user list.");
  }
}

/*************************************************
 * 4)  Open the “Log Fix” modal for a defective PC
 *************************************************/
function openFixModal(card) {
  fixModal.dataset.room = $("#room-select").value;
  fixModal.dataset.pc   = card.dataset.pc;

  fixDate.value   = todayISO();
  fixerInput.value = "";

  fixModal.classList.remove("hidden");
  fixerInput.focus();
}

/*************************************************
 * 5)  Submit the fix entry to backend
 *************************************************/
fixForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const roomID   = fixModal.dataset.room;
  const pcNumber = fixModal.dataset.pc;
  const fixedOn  = fixDate.value;
  const fixer    = fixerInput.value.trim();

  const user = userRoster.find((u) => u.fullName === fixer);
  if (!user) {
    alert("Please pick a name from the list.");
    return fixerInput.focus();
  }

  try {
    await fetch("../api/fix.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomID,
        pcNumber,
        fixedOn,
        fixedBy: user.userId,
      }),
    });

    fixModal.classList.add("hidden");
    if (typeof refreshGrid === "function") refreshGrid(); // defined in rooms.js
  } catch (err) {
    console.error(err);
    alert("Could not save the fix entry.");
  }
});

/*************************************************
 * 6)  Close-button handler
 *************************************************/
fixCancel.addEventListener("click", () => fixModal.classList.add("hidden"));

/*************************************************
 * 7)  Bootstrap  – attach early-capture listener
 *************************************************/
document.addEventListener('DOMContentLoaded', () => {
  loadUsers();

  /* Click anywhere in the document, BUT in capture phase
     so we run before other “click” handlers.              */
  document.addEventListener(
    'click',
    (e) => {
      const card = e.target.closest('.pc-card');
      if (!card) return;

      /* At this point the dataset still says 'Defective'   */
      if (card.dataset.status === 'Defective') {
        e.stopPropagation();          // keep other handlers, but run ours first
        openFixModal(card);
      }
    },
    /* capture = true 👉 handler runs on the way **down**   */
    true
  );
});
