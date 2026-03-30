const stage = document.getElementById("stage");
const playfield = document.getElementById("playfield");
const mazeImage = document.getElementById("mazeImage");
const strawberry = document.getElementById("strawberry");
const strawberryImage = document.getElementById("strawberryImage");
const basketImage = document.getElementById("basketImage");
const basketBox = document.querySelector(".blender--game");
const mazeMask = document.getElementById("mazeMask");
const maskCtx = mazeMask.getContext("2d", { willReadFrequently: true });

const state = {
  dragging: false,
  completed: false,
  canReadMazePixels: true,
  offsetX: 0,
  offsetY: 0,
  pointerId: null,
  strawberryWidth: 0,
  strawberryHeight: 0,
};

const WALL_BRIGHTNESS_LIMIT = 540;
const WALL_ALPHA_LIMIT = 25;
const SAFE_PADDING = 10;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function drawMazeMask() {
  mazeMask.width = mazeImage.naturalWidth;
  mazeMask.height = mazeImage.naturalHeight;
  maskCtx.clearRect(0, 0, mazeMask.width, mazeMask.height);
  maskCtx.drawImage(mazeImage, 0, 0, mazeMask.width, mazeMask.height);
}

function updateStrawberrySize() {
  state.strawberryWidth = strawberry.offsetWidth;
  state.strawberryHeight = strawberry.offsetHeight;
}

function setStrawberryPosition(x, y) {
  strawberry.style.left = `${x}px`;
  strawberry.style.top = `${y}px`;
}

function getRectInsideStage(element) {
  return {
    left: element.offsetLeft,
    top: element.offsetTop,
    right: element.offsetLeft + element.offsetWidth,
    bottom: element.offsetTop + element.offsetHeight,
    width: element.offsetWidth,
    height: element.offsetHeight,
  };
}

function imagePointFromStage(stageX, stageY) {
  const mazeRect = getRectInsideStage(playfield);
  const localX = stageX - mazeRect.left;
  const localY = stageY - mazeRect.top;
  const scaleX = mazeMask.width / mazeRect.width;
  const scaleY = mazeMask.height / mazeRect.height;

  return {
    x: clamp(Math.round(localX * scaleX), 0, mazeMask.width - 1),
    y: clamp(Math.round(localY * scaleY), 0, mazeMask.height - 1),
  };
}

function isPointInsideMaze(stageX, stageY) {
  const mazeRect = getRectInsideStage(playfield);

  return (
    stageX >= mazeRect.left &&
    stageX <= mazeRect.right &&
    stageY >= mazeRect.top &&
    stageY <= mazeRect.bottom
  );
}

function isWallAt(stageX, stageY) {
  if (!state.canReadMazePixels || !isPointInsideMaze(stageX, stageY)) {
    return false;
  }

  const point = imagePointFromStage(stageX, stageY);
  let pixel;

  try {
    pixel = maskCtx.getImageData(point.x, point.y, 1, 1).data;
  } catch (error) {
    state.canReadMazePixels = false;
    return false;
  }

  const [r, g, b, a] = pixel;
  const brightness = r + g + b;

  return a > WALL_ALPHA_LIMIT && brightness < WALL_BRIGHTNESS_LIMIT;
}

function isValidPosition(nextX, nextY) {
  const centerX = nextX + state.strawberryWidth / 2;
  const centerY = nextY + state.strawberryHeight / 2;
  const points = [
    { x: centerX, y: centerY },
    { x: nextX + SAFE_PADDING, y: nextY + SAFE_PADDING },
    { x: nextX + state.strawberryWidth - SAFE_PADDING, y: nextY + SAFE_PADDING },
    { x: nextX + SAFE_PADDING, y: nextY + state.strawberryHeight - SAFE_PADDING },
    {
      x: nextX + state.strawberryWidth - SAFE_PADDING,
      y: nextY + state.strawberryHeight - SAFE_PADDING,
    },
  ];

  return points.every((point) => !isWallAt(point.x, point.y));
}

function getStartPosition() {
  updateStrawberrySize();
  const strawberryStyles = window.getComputedStyle(strawberry);
  const initialLeft = Number.parseFloat(strawberryStyles.left);
  const initialTop = Number.parseFloat(strawberryStyles.top);

  return {
    x: Number.isFinite(initialLeft) ? initialLeft : 16,
    y: Number.isFinite(initialTop) ? initialTop : 800,
  };
}

function completeMaze() {
  if (state.completed) {
    return;
  }

  state.completed = true;
  basketImage.src = "images/basket2.png";
  basketBox.classList.add("is-complete");
}

function tryComplete(nextX, nextY) {
  const basketRect = getRectInsideStage(basketBox);
  const centerX = nextX + state.strawberryWidth / 2;
  const centerY = nextY + state.strawberryHeight / 2;

  if (
    centerX >= basketRect.left &&
    centerX <= basketRect.right &&
    centerY >= basketRect.top &&
    centerY <= basketRect.bottom
  ) {
    completeMaze();
  }
}

function moveStrawberry(clientX, clientY) {
  if (!state.dragging || state.completed) {
    return;
  }

  const stageBounds = stage.getBoundingClientRect();
  const nextX = clamp(
    clientX - stageBounds.left - state.offsetX,
    0,
    stage.clientWidth - state.strawberryWidth
  );
  const nextY = clamp(
    clientY - stageBounds.top - state.offsetY,
    0,
    stage.scrollHeight - state.strawberryHeight
  );

  if (isValidPosition(nextX, nextY)) {
    setStrawberryPosition(nextX, nextY);
    tryComplete(nextX, nextY);
  } else if (!isPointInsideMaze(nextX + state.strawberryWidth / 2, nextY + state.strawberryHeight / 2)) {
    setStrawberryPosition(nextX, nextY);
  }
}

function handleMouseMove(event) {
  if (state.pointerId !== null && event.pointerId !== state.pointerId) {
    return;
  }

  moveStrawberry(event.clientX, event.clientY);
}

function stopDragging() {
  state.dragging = false;
  if (state.pointerId !== null) {
    try {
      strawberry.releasePointerCapture(state.pointerId);
    } catch (error) {
    }
  }
  state.pointerId = null;
  strawberry.classList.remove("is-dragging");
}

function startDragging(event) {
  if (state.completed) {
    return;
  }

  event.preventDefault();
  updateStrawberrySize();
  const bounds = strawberry.getBoundingClientRect();

  state.dragging = true;
  state.offsetX = event.clientX - bounds.left;
  state.offsetY = event.clientY - bounds.top;
  state.pointerId = "pointerId" in event ? event.pointerId : null;

  if (state.pointerId !== null) {
    try {
      strawberry.setPointerCapture(state.pointerId);
    } catch (error) {
    }
  }

  strawberry.classList.add("is-dragging");
}

function setupGame() {
  if (!mazeImage.naturalWidth || !strawberryImage || !strawberryImage.naturalWidth) {
    return;
  }

  drawMazeMask();
  const start = getStartPosition();
  setStrawberryPosition(start.x, start.y);
}

function initializeGame() {
  setupGame();
}

function resetGameState() {
  state.completed = false;
  basketImage.src = "images/basket1.png";
  basketBox.classList.remove("is-complete");
  drawMazeMask();
  const start = getStartPosition();
  setStrawberryPosition(start.x, start.y);
  if (ticketResult) {
    ticketResult.hidden = true;
    ticketResult.classList.remove("is-visible");
  }
}

if (mazeImage.complete && strawberryImage && strawberryImage.complete) {
  initializeGame();
}

mazeImage.addEventListener("load", initializeGame);
if (strawberryImage) {
  strawberryImage.addEventListener("load", initializeGame);
}
window.addEventListener("load", initializeGame);

window.addEventListener("resize", () => {
  if (!mazeImage.naturalWidth) {
    return;
  }

  setupGame();
});

strawberry.addEventListener("pointerdown", startDragging);
if (strawberryImage) {
  strawberryImage.addEventListener("dragstart", (event) => event.preventDefault());
}
window.addEventListener("pointermove", handleMouseMove);
window.addEventListener("pointerup", stopDragging);
window.addEventListener("pointercancel", stopDragging);

const jackpotButton = document.getElementById("jackpotButton");
const ticketResult = document.getElementById("ticketResult");
const tickets = [
  "images/ticket1.png",
  "images/ticket2.png",
  "images/ticket3.png",
];

if (jackpotButton && ticketResult) {
  jackpotButton.addEventListener("click", () => {
    const randomIndex = Math.floor(Math.random() * tickets.length);
    ticketResult.src = tickets[randomIndex];
    ticketResult.hidden = false;
    ticketResult.classList.add("is-visible");
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "r") {
    resetGameState();
  }
});

const scratchCards = Array.from(document.querySelectorAll(".scratch-card"));
const scratchCardState = new WeakMap();
const SCRATCH_RADIUS = 22;

function getScratchState(card) {
  if (!scratchCardState.has(card)) {
    scratchCardState.set(card, {
      overlayImage: null,
      pointerId: null,
      scratching: false,
    });
  }

  return scratchCardState.get(card);
}

function drawScratchCover(card) {
  const canvas = card.querySelector(".scratch-card__cover");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  const width = card.clientWidth;
  const height = card.clientHeight;
  const overlaySrc = card.dataset.overlay;
  const state = getScratchState(card);

  if (!overlaySrc || !width || !height) {
    return;
  }

  if (!state.overlayImage) {
    const image = new Image();
    image.src = overlaySrc;
    image.addEventListener("load", () => {
      drawScratchCover(card);
    });
    state.overlayImage = image;
  }

  if (!state.overlayImage.complete) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(state.overlayImage, 0, 0, width, height);
}

function eraseScratchAt(card, event) {
  const canvas = card.querySelector(".scratch-card__cover");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(x, y, SCRATCH_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function stopScratch(card, event) {
  const state = getScratchState(card);

  if (
    state.pointerId !== null &&
    event &&
    "pointerId" in event &&
    event.pointerId !== state.pointerId
  ) {
    return;
  }

  state.scratching = false;

  if (state.pointerId !== null) {
    const canvas = card.querySelector(".scratch-card__cover");

    if (canvas) {
      try {
        canvas.releasePointerCapture(state.pointerId);
      } catch (error) {
      }
    }
  }

  state.pointerId = null;
}

function bindScratchCard(card) {
  const canvas = card.querySelector(".scratch-card__cover");
  if (!canvas) {
    return;
  }

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();

    const state = getScratchState(card);
    state.scratching = true;
    state.pointerId = event.pointerId;

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
    }

    eraseScratchAt(card, event);
  });

  canvas.addEventListener("pointermove", (event) => {
    const state = getScratchState(card);

    if (!state.scratching || event.pointerId !== state.pointerId) {
      return;
    }

    eraseScratchAt(card, event);
  });

  canvas.addEventListener("pointerup", (event) => {
    stopScratch(card, event);
  });

  canvas.addEventListener("pointercancel", (event) => {
    stopScratch(card, event);
  });
}

function initializeScratchCards() {
  scratchCards.forEach((card) => {
    if (!card.dataset.scratchReady) {
      bindScratchCard(card);
      card.dataset.scratchReady = "true";
    }

    drawScratchCover(card);
  });
}

initializeScratchCards();
window.addEventListener("load", initializeScratchCards);
window.addEventListener("resize", initializeScratchCards);

const gameContainer = document.querySelector(".game-container");
const puzzlePieces = Array.from(document.querySelectorAll(".puzzle-piece"));
const puzzleFrame = document.querySelector(".puzzle-frame");
const puzzleDragState = {
  activePiece: null,
  pointerId: null,
  offsetX: 0,
  offsetY: 0,
};

function isPieceInsideFrame(piece) {
  if (!puzzleFrame) {
    return false;
  }

  const frameRect = puzzleFrame.getBoundingClientRect();
  const pieceRect = piece.getBoundingClientRect();
  const pieceCenterX = pieceRect.left + pieceRect.width / 2;
  const pieceCenterY = pieceRect.top + pieceRect.height / 2;

  return (
    pieceCenterX >= frameRect.left &&
    pieceCenterX <= frameRect.right &&
    pieceCenterY >= frameRect.top &&
    pieceCenterY <= frameRect.bottom
  );
}

function checkPuzzleCompletion() {
  const allSnapped = puzzlePieces.every((piece) => piece.classList.contains("is-snapped"));

  if (puzzleFrame) {
    puzzleFrame.classList.toggle("is-full", allSnapped);
  }
}

function startPuzzleDrag(event) {
  event.preventDefault();

  const piece = event.currentTarget;
  const bounds = piece.getBoundingClientRect();
  piece.classList.remove("is-snapped");

  puzzleDragState.activePiece = piece;
  puzzleDragState.pointerId = event.pointerId;
  puzzleDragState.offsetX = event.clientX - bounds.left;
  puzzleDragState.offsetY = event.clientY - bounds.top;

  piece.classList.add("is-dragging");

  try {
    piece.setPointerCapture(event.pointerId);
  } catch (error) {
  }
}

function movePuzzlePiece(event) {
  const piece = puzzleDragState.activePiece;

  if (!piece || event.pointerId !== puzzleDragState.pointerId || !gameContainer) {
    return;
  }

  const containerBounds = gameContainer.getBoundingClientRect();
  const nextX = clamp(
    event.clientX - containerBounds.left - puzzleDragState.offsetX,
    0,
    gameContainer.clientWidth - piece.offsetWidth
  );
  const nextY = clamp(
    event.clientY - containerBounds.top - puzzleDragState.offsetY,
    0,
    gameContainer.scrollHeight - piece.offsetHeight
  );

  piece.style.left = `${nextX}px`;
  piece.style.top = `${nextY}px`;
  piece.style.right = "auto";
}

function stopPuzzleDrag(event) {
  const piece = puzzleDragState.activePiece;

  if (!piece || event.pointerId !== puzzleDragState.pointerId) {
    return;
  }

  try {
    piece.releasePointerCapture(event.pointerId);
  } catch (error) {
  }

  piece.classList.remove("is-dragging");
  const insideFrame = isPieceInsideFrame(piece);
  piece.classList.toggle("is-snapped", insideFrame);
  checkPuzzleCompletion();

  puzzleDragState.activePiece = null;
  puzzleDragState.pointerId = null;
}

puzzlePieces.forEach((piece) => {
  piece.addEventListener("pointerdown", startPuzzleDrag);
  piece.addEventListener("dragstart", (event) => event.preventDefault());
});

window.addEventListener("pointermove", movePuzzlePiece);
window.addEventListener("pointerup", stopPuzzleDrag);
window.addEventListener("pointercancel", stopPuzzleDrag);

const recipeBowl = document.getElementById("recipeBowl");
const recipeButtons = Array.from(document.querySelectorAll(".recipe-button"));

recipeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!recipeBowl || !button.dataset.bowl) {
      return;
    }

    recipeBowl.src = button.dataset.bowl;
  });
});
