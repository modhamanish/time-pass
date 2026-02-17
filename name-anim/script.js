const canvas = document.getElementById("nameCanvas");
const ctx = canvas.getContext("2d");
const input = document.getElementById("nameInput");
const button = document.getElementById("startButton");

let width, height;
const ANIMATION_DURATION = 10000; // 10 seconds
let startTime = null;
let pointGroups = []; // Array of { points: [], lines: [] } for each character
let isAnimating = false;

function resize() {
  width = canvas.width =
    canvas.parentElement.clientWidth * window.devicePixelRatio;
  height = canvas.height =
    canvas.parentElement.clientHeight * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  width /= window.devicePixelRatio;
  height /= window.devicePixelRatio;
}

window.addEventListener("resize", resize);
resize();

function sampleText(text) {
  const groups = [];
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  tempCanvas.width = width;
  tempCanvas.height = height;

  // Split text into words for multi-line support
  const words = text.split(/\s+/).filter((w) => w.length > 0);

  // FONT SIZE CALCULATION: Maximize based on words
  const longestWord = words.reduce((a, b) => (a.length > b.length ? a : b), "");
  const horizontalScale = width / (longestWord.length * 0.85);
  const verticalScale = (height * 0.85) / (words.length || 1);
  const fontSize = Math.min(horizontalScale, verticalScale * 0.85);

  const fontStack = `'Outfit', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif`;
  tempCtx.font = `900 ${fontSize}px ${fontStack}`;
  tempCtx.textBaseline = "middle";
  tempCtx.textAlign = "center";
  tempCtx.fillStyle = "white";

  const lineHeight = fontSize * 1.1;
  const totalHeight = words.length * lineHeight;
  let currentY = (height - totalHeight) / 2 + lineHeight / 2;

  for (let word of words) {
    const wordWidth = tempCtx.measureText(word).width;
    let charX = (width - wordWidth) / 2;

    for (let char of word) {
      tempCtx.clearRect(0, 0, width, height);
      tempCtx.fillText(char, width / 2, height / 2);

      const imageData = tempCtx.getImageData(0, 0, width, height).data;
      const charWidthMeasure = tempCtx.measureText(char).width;
      const charPoints = [];
      const step = 2;

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const index = (y * width + x) * 4;
          if (imageData[index + 3] > 128) {
            charPoints.push({
              x: x - width / 2 + charX + charWidthMeasure / 2,
              y: y - height / 2 + currentY,
            });
          }
        }
      }

      for (let i = charPoints.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [charPoints[i], charPoints[j]] = [charPoints[j], charPoints[i]];
      }

      const charLines = [];
      const connectionRadius = 15;
      const maxConnections = 2;

      for (let i = 0; i < charPoints.length; i++) {
        const p1 = charPoints[i];
        let found = 0;
        const searchLimit = 50;
        const startRange = Math.max(0, i - searchLimit);
        const endRange = Math.min(charPoints.length, i + searchLimit);

        for (let j = startRange; j < endRange; j++) {
          if (i === j) continue;
          const p2 = charPoints[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist < connectionRadius) {
            charLines.push({ p1Idx: i, p2Idx: j });
            found++;
            if (found >= maxConnections) break;
          }
        }
      }

      groups.push({ points: charPoints, lines: charLines });
      charX += charWidthMeasure;
    }
    currentY += lineHeight;
  }
  return groups;
}

async function startAnimation() {
  const text = input.value.trim();
  if (!text) return;

  // Ensure fonts are ready before starting to avoid race conditions
  if (document.fonts) {
    await document.fonts.ready;
  }

  // Small delay for mobile stability (ensures layout is final)
  await new Promise((resolve) => setTimeout(resolve, 100));

  isAnimating = true;
  startTime = null;
  pointGroups = sampleText(text);
  requestAnimationFrame(animate);
}

function drawCharGroup(group, progress) {
  if (group.points.length === 0) return;

  const visiblePointCount = Math.floor(progress * group.points.length);

  ctx.lineWidth = 0.3;
  ctx.strokeStyle = "#FF99AA";
  ctx.shadowBlur = 4;
  ctx.shadowColor = "#FF3366";
  ctx.globalAlpha = 0.1 + progress * 0.3;

  ctx.beginPath();
  for (const line of group.lines) {
    if (line.p1Idx < visiblePointCount && line.p2Idx < visiblePointCount) {
      const p1 = group.points[line.p1Idx];
      const p2 = group.points[line.p2Idx];
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 1.0;
}

function animate(timestamp) {
  if (!startTime) startTime = timestamp;
  const elapsed = timestamp - startTime;
  const totalProgress = Math.min(elapsed / ANIMATION_DURATION, 1);

  ctx.clearRect(0, 0, width, height);

  if (pointGroups.length === 0) return;

  const charCount = pointGroups.length;
  const charDuration = ANIMATION_DURATION / charCount;
  const activeCharIndex = Math.floor(elapsed / charDuration);

  for (let i = 0; i < Math.min(activeCharIndex, charCount); i++) {
    drawCharGroup(pointGroups[i], 1.0);
  }

  if (activeCharIndex < charCount) {
    const charElapsed = elapsed % charDuration;
    const charProgress = charElapsed / charDuration;
    drawCharGroup(pointGroups[activeCharIndex], charProgress);
  }

  if (totalProgress < 1) {
    requestAnimationFrame(animate);
  }
}

button.addEventListener("click", startAnimation);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") startAnimation();
});

// URL PARAMETER SUPPORT
function checkURLParams() {
  const params = new URLSearchParams(window.location.search);
  const urlInput = params.get("input");

  if (urlInput) {
    const cleanInput = urlInput.replace(/^["']|["']$/g, "");
    input.value = cleanInput;
    const container = document.querySelector(".input-container");
    if (container) container.style.display = "none";
    setTimeout(startAnimation, 500);
  }
}

// Ensure fonts are loaded before declaring ready to avoid layout shifts
if (document.fonts) {
  document.fonts.ready.then(() => {
    button.innerText = "Start Animation";
    button.disabled = false;
    checkURLParams();
  });
  // Mark as loading initially if fonts are not ready
  if (!document.fonts.check("900 16px Outfit")) {
    button.innerText = "Loading Fonts...";
    button.disabled = true;
  }
} else {
  checkURLParams();
}
