/**
 * Card Editor - Main Application Logic
 * =========================================
 * 
 * IMPORTANT SECURITY NOTE:
 * Do NOT add your OpenAI API key here! Keep it on a backend server.
 * For production, create a backend API endpoint that safely handles OpenAI requests.
 * 
 * Example backend setup:
 * - Create /api/generate-quote endpoint
 * - Store API key in environment variables on server
 * - Frontend calls your backend, backend calls OpenAI
 */

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// ✅ SECURE: Using Vercel serverless functions (same domain)
// No API key exposed! Backend functions handle OpenAI calls securely.
const BACKEND_URL = ""; // Empty = same domain, API is at /api/

const quote1OpenAIButton = document.getElementById("quote1OpenAIButton");
const quoteHistoryButton = document.getElementById("quoteHistoryButton");
const openaiImageButton = document.getElementById("openaiImageButton");
const generatorImagePanel = document.getElementById("generatorImagePanel");
const openaiHistoryPanel = document.getElementById("openaiHistoryPanel");
const openaiHistoryList = document.getElementById("openaiHistoryList");
const openaiHistoryEmpty = document.getElementById("openaiHistoryEmpty");
const openaiHistoryClear = document.getElementById("openaiHistoryClear");
const HISTORY_LIMIT = 20;
const HISTORY_KEY = "quote1-openai-history";
let quoteHistory = [];

function loadQuoteHistory() {
    try {
        const saved = localStorage.getItem(HISTORY_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                quoteHistory = parsed
                    .filter((item) => typeof item?.text === "string" && item.text.trim())
                    .slice(0, HISTORY_LIMIT);
            }
        }
    } catch (err) {
        console.warn("Could not load quote history", err);
        quoteHistory = [];
    }
    updateHistoryUI();
}

function saveQuoteHistory() {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(quoteHistory));
    } catch (err) {
        console.warn("Could not persist quote history", err);
    }
}

function updateHistoryUI() {
    const hasItems = quoteHistory.length > 0;
    openaiHistoryList.innerHTML = "";

    if (hasItems) {
        quoteHistory.forEach((item, index) => {
            const li = document.createElement("li");
            li.className = "openai-history-item";
            li.dataset.index = String(index);
            li.textContent = item.text;
            openaiHistoryList.appendChild(li);
        });
        openaiHistoryList.style.display = "flex";
        openaiHistoryEmpty.style.display = "none";
    } else {
        openaiHistoryList.style.display = "none";
        openaiHistoryEmpty.style.display = "block";
    }
}

function getOpenAiPrompt(prevQuotes = []) {
    const styles = [
        "jurământ mobilizator",
        "verdict moral tăios",
        "metaforă luminoasă",
        "îndemn scurt, imperativ",
        "binecuvântare/urare solemnă",
        "amintire istorică transformată în lecție",
        "declarație personală despre demnitate",
        "chemare la unitate și curaj",
        "exclamație de speranță",
        "sentință populară de tip proverb modern",
        "descriere poetică a familiei și rădăcinilor",
        "strigăt de libertate și dreptate",
        "mărturisire intimă de credință",
        "imaginație vizionară despre viitor",
        "elogiu adus eroilor și sacrificiului",
        "învățătură scurtă pentru tineri",
        "invocație către lumină și adevăr",
        "aforism despre muncă și demnitate",
        "memento al satului și tradiției",
        "binecuvântare pentru România",
    ];
    const bannedStarts = [
        "România",
        "Fără",
        "Credința",
        "Adevărul",
        "Lumina",
        "Jur",
        "Cât timp",
        "Trebuie",
        "Întotdeauna",
        "Să fim",
        "Noi",
    ];
    const style = styles[Math.floor(Math.random() * styles.length)];
    const recent = prevQuotes
        .slice(-8)
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n");

    return [
        `Scrie UN singur citat original, în limba română, fără ghilimele și fără atribuire.`,
        `Lungime: maxim 180 de caractere, 1–2 fraze.`,
        `Teme obligatorii (alege liber combinații): credință, adevăr, lumină, România, familie, demnitate, speranță, istorie.`,
        `Variază STRUCTURA și ÎNCEPUTUL. Stilul pentru această generație: ${style}.`,
        `NU începe cu: ${bannedStarts.join(", ")}.`,
        recent
            ? `Evită să semene cu aceste citate recente (nu repeta structură, ritm, început sau imagini):\n${recent}`
            : ``,
        `Evită clișeele evidente și frazele lungi. Fără enumerări banale.`,
    ]
        .filter(Boolean)
        .join("\n");
}

async function generateQuoteWithOpenAI() {
    const originalWidth = quote1OpenAIButton.offsetWidth;
    quote1OpenAIButton.disabled = true;
    quote1OpenAIButton.classList.add("loading");
    quote1OpenAIButton.style.width = `${originalWidth}px`;

    try {
        const response = await fetch(
            `${BACKEND_URL}/api/generate-quote`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: "system",
                            content:
                                "You craft concise, original inspirational quotes in English. " +
                                "Themes to draw from: faith, truth, light, family, dignity, hope, history, " +
                                "unity, sacrifice, work, freedom, justice, honor, education, future, " +
                                "roots, traditions, heritage, heroism, courage, solidarity, wisdom, resilience, gratitude. " +
                                "Alternate styles: solemn oath, moral verdict, poetic metaphor, rallying call, short blessing, historical lesson. " +
                                "Keep each quote under 180 characters, in 1–2 short sentences. " +
                                "Avoid clichés, vary the structure and opening, no quotation marks or attributions.",
                        },
                        {
                            role: "user",
                            content: getOpenAiPrompt(quoteHistory.map((item) => item.text)),
                        },
                    ],
                    temperature: 1.0,
                    top_p: 0.9,
                    presence_penalty: 0.7,
                    frequency_penalty: 0.6,
                    max_tokens: 130,
                }),
            }
        );

        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            throw new Error(errorPayload.error?.message || response.statusText);
        }

        const data = await response.json();
        const generated = data.choices?.[0]?.message?.content?.trim() || "";

        if (!generated) {
            throw new Error("No quote returned by OpenAI.");
        }

        const cleaned = generated.replace(/^"+|"+$/g, "");
        quote1Input.value = cleaned;
        drawCard();

        if (cleaned) {
            quoteHistory.unshift({ text: cleaned, ts: Date.now() });
            if (quoteHistory.length > HISTORY_LIMIT) {
                quoteHistory = quoteHistory.slice(0, HISTORY_LIMIT);
            }
            saveQuoteHistory();
            updateHistoryUI();
        }
    } catch (err) {
        console.error("OpenAI quote generation failed", err);
        alert(
            `Could not generate quote. ${err instanceof Error ? err.message : "Unknown error"
            }`
        );
    } finally {
        quote1OpenAIButton.disabled = false;
        quote1OpenAIButton.classList.remove("loading");
        quote1OpenAIButton.style.width = "";
    }
}

async function generateImageWithAI() {
    if (!openaiImageButton || !generatorImagePanel) return;

    openaiImageButton.disabled = true;
    const originalWidth = openaiImageButton.offsetWidth;
    openaiImageButton.style.width = `${originalWidth}px`;
    openaiImageButton.classList.add("loading");

    const prompt = getImagePrompt(quote1Input?.value || "");
    console.log("Image prompt:", prompt);
    if (generatorImagePanel) {
        generatorImagePanel.innerHTML = "";
    }

    try {
        const response = await fetch(
            `${BACKEND_URL}/api/generate-image`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt,
                    size: "1024x1024",
                    quality: "standard",
                }),
            }
        );

        if (!response.ok) {
            const errorPayload = await response
                .json()
                .catch(() => ({ message: response.statusText }));
            throw new Error(errorPayload.error?.message || errorPayload.message);
        }

        const payload = await response.json();
        const base64Image = payload.data?.[0]?.b64_json;
        let dataUrl = "";

        if (base64Image) {
            dataUrl = `data:image/png;base64,${base64Image}`;
        } else {
            const remoteUrl =
                payload.data?.[0]?.url || payload.data?.[0]?.image_url;
            if (!remoteUrl) {
                throw new Error("Response does not contain the generated image.");
            }

            const download = await fetch(remoteUrl);
            if (!download.ok) {
                throw new Error("Could not download the generated image.");
            }
            const blob = await download.blob();
            dataUrl = await blobToDataUrl(blob);
        }

        await applyBackgroundImageFromDataUrl(dataUrl);
    } catch (err) {
        console.error("Image generation failed", err);
        if (generatorImagePanel) {
            const error = document.createElement("p");
            error.className = "generator-error";
            error.textContent =
                "Could not generate the image. Try again or check the logs.";
            generatorImagePanel.appendChild(error);
        }
    } finally {
        openaiImageButton.disabled = false;
        openaiImageButton.classList.remove("loading");
        openaiImageButton.style.width = "";
    }
}

// Palettes aligned to your project
const IMAGE_PALETTES = [
    { name: "lumina", colors: ["#F8F5E7", "#EDE7D1", "#C9C2A3", "#8F8A70"] },
    {
        name: "tricolor discret",
        colors: ["#1C2E5A", "#B91D23", "#E7D9AC", "#0E1A33"],
    },
    {
        name: "lemn și filigran",
        colors: ["#3E2C1C", "#A67C52", "#D9C7A4", "#F2E9DA"],
    },
    {
        name: "piatră și aur",
        colors: ["#2C2C2C", "#6B6B6B", "#BCA46A", "#F1E7C8"],
    },
    {
        name: "albastru de Voroneț",
        colors: ["#1C3A5E", "#3F6C9D", "#D7D3C8", "#A08E6A"],
    },
];

const IMAGE_MOTIFS = [
    "ray of light piercing through mist",
    "silhouettes of mountains at sunrise",
    "parchment texture with subtle decorative filigree",
    "cross suggested only by intersection of light rays",
    "traditional textiles rendered abstractly",
    "old stone with patina, obliquely illuminated",
    "stylized oak branches",
    "outlines of wooden churches, almost ghostly",
];

const IMAGE_STYLES = [
    "minimalist, clean, emphasis on light",
    "painterly realism, atmospheric depth",
    "modern illustration with natural textures",
    "conceptual photography with subtle bokeh",
    "modern engraving with clean contrasts",
    "fine-art, calm composition",
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pick2 = (arr) => {
    const a = pick(arr);
    let b = pick(arr);
    while (b === a) b = pick(arr);
    return [a, b];
};

function getImagePrompt(seedQuote = "") {
    const palette = pick(IMAGE_PALETTES);
    const [motif1, motif2] = pick2(IMAGE_MOTIFS);
    const style = pick(IMAGE_STYLES);
    const trimmedSeed = (seedQuote || "").trim();
    const seedLine = trimmedSeed
        ? `Inspiră-te vizual din mesajul: "${trimmedSeed}".`
        : "";

    const baseLines = [
        "Background image only, no text, no watermark.",
        seedLine,
    ];

    if (!trimmedSeed) {
        baseLines.splice(
            1,
            0,
            "Theme: credință, adevăr, lumină, România, familie, demnitate, speranță, istorie."
        );
        baseLines.splice(
            2,
            0,
            `Composition: ${style}; ${motif1}; ${motif2}; spațiu negativ pentru tipografie.`
        );
        baseLines.splice(
            3,
            0,
            `Color palette: ${palette.name} (${palette.colors.join(", ")}).`
        );
    }

    return baseLines
        .filter((line) => line && line.trim().length > 0)
        .join(" ");
}

// Get all inputs
const quote1Input = document.getElementById("quote1");
const quote2Input = document.getElementById("quote2");
const authorInput = document.getElementById("author");
const quote1SizeInput = document.getElementById("quote1Size");
const quote2SizeInput = document.getElementById("quote2Size");
const authorSizeInput = document.getElementById("authorSize");
const quote1LineHeightInput = document.getElementById("quote1LineHeight");
const quote2LineHeightInput = document.getElementById("quote2LineHeight");
const quote1WeightInput = document.getElementById("quote1Weight");
const quote2WeightInput = document.getElementById("quote2Weight");
const authorWeightInput = document.getElementById("authorWeight");
const quote1ColorInput = document.getElementById("quote1Color");
const quote2ColorInput = document.getElementById("quote2Color");
const authorColorInput = document.getElementById("authorColor");

// Drag positioning variables
let quote1Offset = 0;
let quote2Offset = 0;
let authorOffset = 0;
let divider1Offset = 0;
let isDragging = false;
let dragTarget = null;
let startY = 0;
let startX = 0;

const fontFamilyInput = document.getElementById("fontFamily");
const cardWidthInput = document.getElementById("cardWidth");
const cardHeightInput = document.getElementById("cardHeight");
const bgColorInput = document.getElementById("bgColor");
const cardColorInput = document.getElementById("cardColor");
const dividerColorInput = document.getElementById("dividerColor");
const showDividersInput = document.getElementById("showDividers");
const enableQuote2ToggleInput = document.getElementById("enableQuote2Toggle");
const enableColoredBordersInput = document.getElementById("enableColoredBorders");
const bgImageInput = document.getElementById("bgImageInput");
const bgImageOpacityInput = document.getElementById("bgImageOpacity");
const bgImageOpacityValue = document.getElementById("bgImageOpacityValue");
const bgImageZoomInput = document.getElementById("bgImageZoom");
const bgImageZoomValue = document.getElementById("bgImageZoomValue");
const bgImageRotateInput = document.getElementById("bgImageRotate");
const bgImageRotateValue = document.getElementById("bgImageRotateValue");

if (quote1OpenAIButton) {
    quote1OpenAIButton.addEventListener(
        "click",
        () => void generateQuoteWithOpenAI()
    );
}

if (quoteHistoryButton) {
    quoteHistoryButton.addEventListener("click", () => {
        const isActive = openaiHistoryPanel.classList.toggle("active");
        quoteHistoryButton.classList.toggle("active", isActive);
        if (isActive) {
            updateHistoryUI();
        }
    });
}

if (openaiImageButton) {
    openaiImageButton.addEventListener(
        "click",
        () => void generateImageWithAI()
    );
}

if (openaiHistoryList) {
    openaiHistoryList.addEventListener("click", (event) => {
        const li = event.target.closest(".openai-history-item");
        if (!li) return;

        const index = Number(li.dataset.index || "");
        const item = quoteHistory[index];
        if (item?.text) {
            quote1Input.value = item.text;
            drawCard();
            openaiHistoryPanel.classList.remove("active");
            quoteHistoryButton.classList.remove("active");
        }
    });
}

if (openaiHistoryClear) {
    openaiHistoryClear.addEventListener("click", () => {
        quoteHistory = [];
        saveQuoteHistory();
        updateHistoryUI();
    });
}

document.addEventListener("click", (event) => {
    if (
        openaiHistoryPanel &&
        !openaiHistoryPanel.contains(event.target) &&
        quoteHistoryButton &&
        !quoteHistoryButton.contains(event.target)
    ) {
        openaiHistoryPanel.classList.remove("active");
        quoteHistoryButton.classList.remove("active");
    }
});

loadQuoteHistory();

// Background image variables
let backgroundImage = null;
let backgroundImageData = null;
let bgImagePanX = 0;
let bgImagePanY = 0;
let isDraggingImage = false;

// Preview background state
let currentPreviewBg = "light";

// Initialize
enableQuote2ToggleInput.checked = false;

function updatePreviewBackground() {
    const preview = document.querySelector(".preview");
    if (currentPreviewBg === "dark") {
        preview.style.background = "#1a1a1a";
    } else {
        preview.style.background = "#fff";
    }
}

// Dark background toggle
const darkBackgroundToggle = document.getElementById("darkBackgroundToggle");
darkBackgroundToggle.addEventListener("change", function () {
    currentPreviewBg = this.checked ? "dark" : "light";
    updatePreviewBackground();
});

function drawCard() {
    const width = parseInt(cardWidthInput.value);
    const height = parseInt(cardHeightInput.value);
    canvas.width = width;
    canvas.height = height;

    const quote1 = quote1Input.value || quote1Input.placeholder;
    const quote2 = quote2Input.value || quote2Input.placeholder;
    const author = authorInput.value || authorInput.placeholder;
    const quote1Size = parseInt(quote1SizeInput.value);
    const quote2Size = parseInt(quote2SizeInput.value);
    const authorSize = parseInt(authorSizeInput.value);
    const quote1LineHeight = parseFloat(quote1LineHeightInput.value);
    const quote2LineHeight = parseFloat(quote2LineHeightInput.value);
    const quote1Weight = quote1WeightInput.value;
    const quote2Weight = quote2WeightInput.value;
    const authorWeight = authorWeightInput.value;
    const quote1Color = quote1ColorInput.value;
    const quote2Color = quote2ColorInput.value;
    const authorColor = authorColorInput.value;
    const fontFamily = fontFamilyInput.value;
    const bgColor = bgColorInput.value;
    const cardColor = cardColorInput.value;
    const enableQuote2 = enableQuote2ToggleInput.checked;
    const enableColoredBorders = enableColoredBordersInput.checked;

    // Fill outside background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Draw triple border (red, yellow, blue)
    const borderWidth = 5;
    const marginFromEdge = 38;

    if (enableColoredBorders) {
        ctx.strokeStyle = "#FF0000";
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(
            marginFromEdge + borderWidth / 2,
            marginFromEdge + borderWidth / 2,
            width - 2 * marginFromEdge - borderWidth,
            height - 2 * marginFromEdge - borderWidth
        );

        ctx.strokeStyle = "#FFE500";
        ctx.lineWidth = borderWidth;
        const offset1 = marginFromEdge + borderWidth;
        ctx.strokeRect(
            offset1 + borderWidth / 2,
            offset1 + borderWidth / 2,
            width - 2 * offset1 - borderWidth,
            height - 2 * offset1 - borderWidth
        );

        ctx.strokeStyle = "#0287FF";
        ctx.lineWidth = borderWidth;
        const offset2 = offset1 + borderWidth;
        ctx.strokeRect(
            offset2 + borderWidth / 2,
            offset2 + borderWidth / 2,
            width - 2 * offset2 - borderWidth,
            height - 2 * offset2 - borderWidth
        );
    }

    const offset2 = enableColoredBorders
        ? marginFromEdge + borderWidth * 3
        : marginFromEdge;

    const innerPadding = 40;
    const innerStart = offset2 + innerPadding;
    const cardInnerX = offset2;
    const cardInnerY = offset2;
    const cardInnerWidth = width - 2 * offset2;
    const cardInnerHeight = height - 2 * offset2;

    ctx.fillStyle = cardColor;
    ctx.fillRect(cardInnerX, cardInnerY, cardInnerWidth, cardInnerHeight);

    // Draw background image if loaded
    if (backgroundImage) {
        const opacity = parseFloat(bgImageOpacityInput.value);
        const zoom = parseFloat(bgImageZoomInput.value);
        const rotation = parseFloat(bgImageRotateInput.value) * (Math.PI / 180);
        ctx.save();
        ctx.globalAlpha = opacity;

        const imgAspect = backgroundImage.width / backgroundImage.height;
        const areaAspect = cardInnerWidth / cardInnerHeight;

        let baseWidth, baseHeight;

        if (imgAspect > areaAspect) {
            baseHeight = cardInnerHeight;
            baseWidth = baseHeight * imgAspect;
        } else {
            baseWidth = cardInnerWidth;
            baseHeight = baseWidth / imgAspect;
        }

        const drawWidth = baseWidth * zoom;
        const drawHeight = baseHeight * zoom;

        let drawX = cardInnerX + (cardInnerWidth - drawWidth) / 2 + bgImagePanX;
        let drawY = cardInnerY + (cardInnerHeight - drawHeight) / 2 + bgImagePanY;

        const minDrawX = cardInnerX + cardInnerWidth - drawWidth;
        const maxDrawX = cardInnerX;
        const minDrawY = cardInnerY + cardInnerHeight - drawHeight;
        const maxDrawY = cardInnerY;

        drawX = Math.max(minDrawX, Math.min(maxDrawX, drawX));
        drawY = Math.max(minDrawY, Math.min(maxDrawY, drawY));

        ctx.beginPath();
        ctx.rect(cardInnerX, cardInnerY, cardInnerWidth, cardInnerHeight);
        ctx.clip();

        const centerX = drawX + drawWidth / 2;
        const centerY = drawY + drawHeight / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.translate(-centerX, -centerY);

        ctx.drawImage(backgroundImage, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
    }

    // Content area
    const padding = innerStart;
    const contentWidth = width - 2 * padding;
    const contentHeight = height - 2 * padding;

    ctx.fillStyle = "#000";
    ctx.textAlign = "center";

    const dividerWidth = 350;
    const quoteTopPadding = 60;
    const quoteBottomPadding = 60;
    const dividerGapBefore = 30;
    const dividerGapAfter = 60;

    ctx.font = `${quote1Weight} ${quote1Size}px ${fontFamily}`;
    const lines1 = wrapText(ctx, quote1, contentWidth);
    const quote1LineAdvance = quote1Size * quote1LineHeight;
    const quote1BlockHeight =
        lines1.length === 0 ? 0 : quote1Size + (lines1.length - 1) * quote1LineAdvance;

    let lines2 = [];
    let quote2LineAdvance = 0;
    let quote2BlockHeight = 0;

    if (enableQuote2 && quote2.trim()) {
        ctx.font = `${quote2Weight} ${quote2Size}px ${fontFamily}`;
        lines2 = wrapText(ctx, quote2, contentWidth);
        quote2LineAdvance = quote2Size * quote2LineHeight;
        quote2BlockHeight =
            lines2.length === 0 ? 0 : quote2Size + (lines2.length - 1) * quote2LineAdvance;
    }

    const hasQuote2 = enableQuote2 && quote2.trim() && lines2.length > 0;
    const divider2YBase = author.trim()
        ? height - padding - authorSize - 10
        : height - padding - 40;
    const quoteAreaTop = padding + quoteTopPadding;
    const quoteAreaBottom = Math.max(quoteAreaTop, divider2YBase - quoteBottomPadding);

    let divider1Y = null;
    ctx.font = `${quote1Weight} ${quote1Size}px ${fontFamily}`;

    if (hasQuote2) {
        const totalAdjustableHeight = Math.max(
            quoteAreaBottom - quoteAreaTop - dividerGapBefore - dividerGapAfter,
            0
        );
        const totalBlockHeight = Math.max(quote1BlockHeight + quote2BlockHeight, 1);
        const quote1AreaHeight =
            totalAdjustableHeight * (quote1BlockHeight / totalBlockHeight);
        const quote2AreaHeight = totalAdjustableHeight - quote1AreaHeight;

        const quote1AreaTop = quoteAreaTop;
        const quote1AreaBottom = quote1AreaTop + quote1AreaHeight;
        const baseDivider1Y = quote1AreaBottom + dividerGapBefore;
        divider1Y = baseDivider1Y + divider1Offset;
        const quote2AreaTop = baseDivider1Y + dividerGapAfter;
        const quote2AreaBottom = quote2AreaTop + quote2AreaHeight;

        let quote1StartY =
            quote1AreaTop + (quote1AreaHeight - quote1BlockHeight) / 2 + quote1Offset;
        let quote2StartY =
            quote2AreaTop + (quote2AreaHeight - quote2BlockHeight) / 2 + quote2Offset;

        // Draw dividers first
        if (showDividersInput.checked) {
            ctx.strokeStyle = dividerColorInput.value;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(width / 2 - dividerWidth / 2, divider1Y);
            ctx.lineTo(width / 2 + dividerWidth / 2, divider1Y);
            ctx.stroke();

            if (author.trim()) {
                const divider2Y = height - padding - authorSize - 10;
                ctx.strokeStyle = dividerColorInput.value;
                ctx.beginPath();
                ctx.moveTo(width / 2 - dividerWidth / 2, divider2Y);
                ctx.lineTo(width / 2 + dividerWidth / 2, divider2Y);
                ctx.stroke();
            }
        }

        // Draw text on top
        ctx.fillStyle = quote1Color;
        let currentY = quote1StartY;
        ctx.font = `${quote1Weight} ${quote1Size}px ${fontFamily}`;
        lines1.forEach((line) => {
            ctx.fillText(line, width / 2, currentY);
            currentY += quote1LineAdvance;
        });

        ctx.fillStyle = quote2Color;
        currentY = quote2StartY;
        ctx.font = `${quote2Weight} ${quote2Size}px ${fontFamily}`;
        lines2.forEach((line) => {
            ctx.fillText(line, width / 2, currentY);
            currentY += quote2LineAdvance;
        });

        if (author.trim()) {
            ctx.font = `${authorWeight} ${authorSize}px ${fontFamily}`;
            ctx.fillStyle = authorColor;
            ctx.fillText(author, width / 2, height - padding + 8 + authorOffset);
        }
    } else {
        const quote1AreaHeight = Math.max(quoteAreaBottom - quoteAreaTop, 0);
        let quote1StartY =
            quoteAreaTop + (quote1AreaHeight - quote1BlockHeight) / 2 + quote1Offset;

        if (showDividersInput.checked && author.trim()) {
            const divider2Y = height - padding - authorSize - 10;
            ctx.strokeStyle = dividerColorInput.value;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(width / 2 - dividerWidth / 2, divider2Y);
            ctx.lineTo(width / 2 + dividerWidth / 2, divider2Y);
            ctx.stroke();
        }

        ctx.fillStyle = quote1Color;
        let currentY = quote1StartY;
        ctx.font = `${quote1Weight} ${quote1Size}px ${fontFamily}`;
        lines1.forEach((line) => {
            ctx.fillText(line, width / 2, currentY);
            currentY += quote1LineAdvance;
        });

        if (author.trim()) {
            ctx.font = `${authorWeight} ${authorSize}px ${fontFamily}`;
            ctx.fillStyle = authorColor;
            ctx.fillText(author, width / 2, height - padding + 8 + authorOffset);
        }
    }
}

function wrapText(ctx, text, maxWidth) {
    const paragraphs = text.split("\n");
    const lines = [];

    paragraphs.forEach((paragraph) => {
        const words = paragraph.split(" ");
        let currentLine = "";

        for (let i = 0; i < words.length; i++) {
            const testLine = currentLine + (currentLine ? " " : "") + words[i];
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = words[i];
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }
    });

    return lines;
}

function isMouseOverText(mouseX, mouseY, textLines, startY, lineHeight, fontSize) {
    if (!textLines || textLines.length === 0) return false;
    const textHeight = fontSize + (textLines.length - 1) * lineHeight;
    const textTop = startY - fontSize * 0.75;
    const textBottom = textTop + textHeight + fontSize * 0.25;
    return mouseY >= textTop && mouseY <= textBottom;
}

function isMouseOverDivider(mouseX, mouseY, dividerY, dividerWidth, width) {
    const threshold = 10;
    const dividerLeft = width / 2 - dividerWidth / 2;
    const dividerRight = width / 2 + dividerWidth / 2;
    return (
        mouseY >= dividerY - threshold &&
        mouseY <= dividerY + threshold &&
        mouseX >= dividerLeft &&
        mouseX <= dividerRight
    );
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
    };
}

function getTextUnderMouse(mouseX, mouseY) {
    const width = parseInt(cardWidthInput.value);
    const height = parseInt(cardHeightInput.value);
    const quote1 = quote1Input.value || quote1Input.placeholder;
    const quote2 = quote2Input.value || quote2Input.placeholder;
    const author = authorInput.value || authorInput.placeholder;
    const enableQuote2 = enableQuote2ToggleInput.checked;

    if (!quote1.trim()) return null;

    const enableColoredBorders = enableColoredBordersInput.checked;
    const borderWidth = 5;
    const marginFromEdge = 38;
    const offset2 = enableColoredBorders
        ? marginFromEdge + borderWidth * 3
        : marginFromEdge;
    const innerPadding = 40;
    const padding = offset2 + innerPadding;

    ctx.font = `${quote1WeightInput.value} ${quote1SizeInput.value}px ${fontFamilyInput.value}`;
    const lines1 = wrapText(ctx, quote1, width - 2 * padding);
    const quote1LineAdvance =
        parseInt(quote1SizeInput.value) * parseFloat(quote1LineHeightInput.value);
    const quote1BlockHeight =
        lines1.length === 0
            ? 0
            : parseInt(quote1SizeInput.value) + (lines1.length - 1) * quote1LineAdvance;
    const quoteTopPadding = 60;
    const quoteBottomPadding = 60;
    const dividerGapBefore = 30;
    const dividerGapAfter = 60;

    const quoteAreaTop = padding + quoteTopPadding;
    const divider2YBase = author.trim()
        ? height - padding - parseInt(authorSizeInput.value) - 10
        : height - padding - 40;
    const quoteAreaBottom = Math.max(quoteAreaTop, divider2YBase - quoteBottomPadding);

    let quote1StartY;

    if (enableQuote2 && quote2.trim()) {
        ctx.font = `${quote2WeightInput.value} ${quote2SizeInput.value}px ${fontFamilyInput.value}`;
        const lines2 = wrapText(ctx, quote2, width - 2 * padding);
        const quote2LineAdvance =
            parseInt(quote2SizeInput.value) * parseFloat(quote2LineHeightInput.value);
        const quote2BlockHeight =
            lines2.length === 0
                ? 0
                : parseInt(quote2SizeInput.value) + (lines2.length - 1) * quote2LineAdvance;

        const totalAdjustableHeight = Math.max(
            quoteAreaBottom - quoteAreaTop - dividerGapBefore - dividerGapAfter,
            0
        );
        const totalBlockHeight = Math.max(quote1BlockHeight + quote2BlockHeight, 1);
        const quote1AreaHeight =
            totalAdjustableHeight * (quote1BlockHeight / totalBlockHeight);
        const quote1AreaTop = quoteAreaTop;
        const quote1AreaBottom = quote1AreaTop + quote1AreaHeight;

        quote1StartY =
            quote1AreaTop + (quote1AreaHeight - quote1BlockHeight) / 2 + quote1Offset;
    } else {
        const quote1AreaHeight = Math.max(quoteAreaBottom - quoteAreaTop, 0);
        quote1StartY =
            quoteAreaTop + (quote1AreaHeight - quote1BlockHeight) / 2 + quote1Offset;
    }

    if (
        isMouseOverText(
            mouseX,
            mouseY,
            lines1,
            quote1StartY,
            quote1LineAdvance,
            parseInt(quote1SizeInput.value)
        )
    ) {
        return "quote1";
    }

    if (enableQuote2 && quote2.trim()) {
        ctx.font = `${quote2WeightInput.value} ${quote2SizeInput.value}px ${fontFamilyInput.value}`;
        const lines2 = wrapText(ctx, quote2, width - 2 * 40);
        const quote2LineAdvance =
            parseInt(quote2SizeInput.value) * parseFloat(quote2LineHeightInput.value);
        const quote2BlockHeight =
            lines2.length === 0
                ? 0
                : parseInt(quote2SizeInput.value) + (lines2.length - 1) * quote2LineAdvance;

        const totalAdjustableHeight = Math.max(
            quoteAreaBottom - quoteAreaTop - dividerGapBefore - dividerGapAfter,
            0
        );
        const totalBlockHeight = Math.max(quote1BlockHeight + quote2BlockHeight, 1);
        const quote1AreaHeight =
            totalAdjustableHeight * (quote1BlockHeight / totalBlockHeight);
        const quote2AreaHeight = totalAdjustableHeight - quote1AreaHeight;
        const baseDivider1Y = quoteAreaTop + quote1AreaHeight + dividerGapBefore;
        const divider1Y = baseDivider1Y + divider1Offset;
        const quote2AreaTop = baseDivider1Y + dividerGapAfter;
        const quote2AreaBottom = quote2AreaTop + quote2AreaHeight;

        if (isMouseOverDivider(mouseX, mouseY, divider1Y, 350, width)) {
            return "divider1";
        }

        const quote2StartY =
            quote2AreaTop + (quote2AreaHeight - quote2BlockHeight) / 2 + quote2Offset;

        if (
            isMouseOverText(
                mouseX,
                mouseY,
                lines2,
                quote2StartY,
                quote2LineAdvance,
                parseInt(quote2SizeInput.value)
            )
        ) {
            return "quote2";
        }
    }

    if (author.trim()) {
        const authorY = height - padding + 8 + authorOffset;
        const authorSize = parseInt(authorSizeInput.value);
        ctx.font = `${authorWeightInput.value} ${authorSize}px ${fontFamilyInput.value}`;

        const authorTop = authorY - authorSize * 0.75;
        const authorBottom = authorTop + authorSize;

        if (mouseY >= authorTop && mouseY <= authorBottom) {
            return "author";
        }
    }

    return null;
}

async function exportCard() {
    const firstQuote = quote1Input.value.trim();
    let filename = "quote-card";

    if (firstQuote) {
        const words = firstQuote.split(/\s+/).slice(0, 4);
        const cleanWords = words
            .map((word) =>
                word
                    .replace(/[^a-zA-Z0-9\u0100-\u017F\u0180-\u024F]/g, "")
                    .toLowerCase()
            )
            .filter((word) => word.length > 0);

        if (cleanWords.length > 0) {
            filename = cleanWords.join("-");
        }
    }

    const mimeType = "image/png";
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile && navigator.canShare) {
        try {
            const blob = await new Promise((resolve) => {
                canvas.toBlob(resolve, mimeType);
            });

            const file = new File([blob], `${filename}.png`, { type: mimeType });

            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: "Quote Card",
                    text: "Save to Photos",
                });
                return;
            }
        } catch (err) {
            console.log("Share cancelled or failed:", err);
        }
    }

    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL(mimeType);
    link.click();
}

function resetStyles() {
    bgColorInput.value = "#E9E5CD";
    cardColorInput.value = "#F6F4E8";
    dividerColorInput.value = "#AFA86A";
    quote1ColorInput.value = "#000000";
    quote2ColorInput.value = "#000000";
    authorColorInput.value = "#8B7355";
    enableColoredBordersInput.checked = true;
    fontFamilyInput.value = "'American Typewriter', 'Courier Prime', monospace";
    quote1SizeInput.value = "70";
    quote2SizeInput.value = "60";
    authorSizeInput.value = "36";
    quote1LineHeightInput.value = "1.4";
    quote2LineHeightInput.value = "1.4";
    quote1WeightInput.value = "600";
    quote2WeightInput.value = "400";
    authorWeightInput.value = "400";
    quote1Offset = 0;
    quote2Offset = 0;
    authorOffset = 0;
    divider1Offset = 0;
    backgroundImage = null;
    backgroundImageData = null;
    bgImageInput.value = "";
    bgImageOpacityInput.value = "0.3";
    updateOpacityDisplay();
    bgImageZoomInput.value = "1";
    updateZoomDisplay();
    bgImagePanX = 0;
    bgImagePanY = 0;
    updateSliderStates();
    drawCard();
}

function resetSize() {
    cardWidthInput.value = "970";
    cardHeightInput.value = "1074";
    drawCard();
}

function resetEverything() {
    resetStyles();
    cardWidthInput.value = "970";
    cardHeightInput.value = "1074";
    drawCard();
}

function showSocialPreview() {
    const modal = document.getElementById("socialPreviewModal");
    const fbImage = document.getElementById("fbPreviewImage");
    const twitterImage = document.getElementById("twitterPreviewImage");

    if (currentPreviewBg === "dark") {
        modal.classList.add("dark-mode");
    } else {
        modal.classList.remove("dark-mode");
    }

    const imageDataUrl = canvas.toDataURL("image/png");
    fbImage.src = imageDataUrl;
    twitterImage.src = imageDataUrl;

    const quoteText = quote1Input.value || quote1Input.placeholder;
    const fbPreviewText = modal.querySelector(
        ".social-preview:nth-child(1) .social-preview-text"
    );
    const twitterPreviewText = modal.querySelector(
        ".social-preview:nth-child(2) .social-preview-text"
    );

    if (fbPreviewText) fbPreviewText.textContent = quoteText;
    if (twitterPreviewText) twitterPreviewText.textContent = quoteText;

    modal.classList.add("active");
}

function closeSocialPreview() {
    const modal = document.getElementById("socialPreviewModal");
    modal.classList.remove("active");
}

document.getElementById("socialPreviewModal").addEventListener("click", (e) => {
    if (e.target.id === "socialPreviewModal") {
        closeSocialPreview();
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeSocialPreview();
    }
});

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
            reject(new Error("Could not convert the generated image."));
        reader.readAsDataURL(blob);
    });
}

function renderGeneratedPreview(dataUrl) {
    if (!generatorImagePanel) return;
    generatorImagePanel.innerHTML = "";
    const preview = document.createElement("img");
    preview.className = "generator-image-preview";
    preview.src = dataUrl;
    preview.alt = "Previzualizare fundal";
    generatorImagePanel.appendChild(preview);
    generatorImagePanel.classList.add("has-image");
}

function applyBackgroundImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            backgroundImage = img;
            backgroundImageData = dataUrl;

            bgImageZoomInput.value = "1";
            updateZoomDisplay();
            bgImageOpacityInput.value = "0.3";
            updateOpacityDisplay();
            bgImageRotateInput.value = "0";
            updateRotateDisplay();

            bgImagePanX = 0;
            bgImagePanY = 0;

            updateSliderStates();
            updateImageButton();

            drawCard();
            if (typeof dataUrl === "string" && dataUrl.startsWith("data:")) {
                renderGeneratedPreview(dataUrl);
            } else if (backgroundImageData) {
                renderGeneratedPreview(backgroundImageData);
            }
            if (generatorImagePanel) {
                generatorImagePanel.classList.add("has-image");
            }
            resolve();
        };
        img.onerror = () => reject(new Error("Could not load the image."));
        img.src = dataUrl;
    });
}

function updateSliderStates() {
    const hasImage = backgroundImage !== null;
    bgImageOpacityInput.disabled = !hasImage;
    bgImageZoomInput.disabled = !hasImage;
    bgImageRotateInput.disabled = !hasImage;
}

bgImageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                await applyBackgroundImageFromDataUrl(event.target.result);
            } catch (err) {
                console.error("Could not set the background image", err);
                alert("There was a problem loading the image.");
            }
        };
        reader.readAsDataURL(file);
    }
});

function updateImageButton() {
    const button = document.getElementById("bgImageButton");
    const text = document.getElementById("bgImageText");
    const icon = document.getElementById("bgImageIcon");

    if (backgroundImage) {
        text.textContent = "Remove Image";
        icon.innerHTML = `
      <path d="M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    `;
        button.onclick = clearBackgroundImage;
    } else {
        text.textContent = "Choose Image";
        icon.innerHTML = `
      <path d="M14 10V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M11.3333 5.33333L8 2L4.66667 5.33333" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 2V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    `;
        button.onclick = () => document.getElementById("bgImageInput").click();
    }
}

function updateOpacityDisplay() {
    const value = parseFloat(bgImageOpacityInput.value);
    const percentage = Math.round(value * 100);
    bgImageOpacityValue.value = percentage + "%";
    drawCard();
}

function updateZoomDisplay() {
    const value = parseFloat(bgImageZoomInput.value);
    const percentage = Math.round(value * 100);
    bgImageZoomValue.value = percentage + "%";
    drawCard();
}

function updateRotateDisplay() {
    const value = parseFloat(bgImageRotateInput.value);
    bgImageRotateValue.value = Math.round(value) + "°";
    drawCard();
}

function incrementOpacity() {
    const currentValue = parseFloat(bgImageOpacityInput.value);
    const step = parseFloat(bgImageOpacityInput.step);
    const max = parseFloat(bgImageOpacityInput.max);
    const newValue = Math.min(max, currentValue + step);
    bgImageOpacityInput.value = newValue;
    updateOpacityDisplay();
}

function decrementOpacity() {
    const currentValue = parseFloat(bgImageOpacityInput.value);
    const step = parseFloat(bgImageOpacityInput.step);
    const min = parseFloat(bgImageOpacityInput.min);
    const newValue = Math.max(min, currentValue - step);
    bgImageOpacityInput.value = newValue;
    updateOpacityDisplay();
}

function incrementZoom() {
    const currentValue = parseFloat(bgImageZoomInput.value);
    const step = parseFloat(bgImageZoomInput.step);
    const max = parseFloat(bgImageZoomInput.max);
    const newValue = Math.min(max, currentValue + step);
    bgImageZoomInput.value = newValue;
    updateZoomDisplay();
}

function decrementZoom() {
    const currentValue = parseFloat(bgImageZoomInput.value);
    const step = parseFloat(bgImageZoomInput.step);
    const min = parseFloat(bgImageZoomInput.min);
    const newValue = Math.max(min, currentValue - step);
    bgImageZoomInput.value = newValue;
    updateZoomDisplay();
}

bgImageOpacityInput.addEventListener("input", updateOpacityDisplay);
bgImageZoomInput.addEventListener("input", updateZoomDisplay);
bgImageRotateInput.addEventListener("input", updateRotateDisplay);

bgImageOpacityValue.addEventListener("input", function () {
    const value = this.value.replace("%", "");
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
        bgImageOpacityInput.value = numValue / 100;
        updateOpacityDisplay();
    }
});

bgImageZoomValue.addEventListener("input", function () {
    const value = this.value.replace("%", "");
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 100 && numValue <= 300) {
        bgImageZoomInput.value = numValue / 100;
        updateZoomDisplay();
    }
});

bgImageRotateValue.addEventListener("input", function () {
    const value = this.value.replace("°", "");
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 360) {
        bgImageRotateInput.value = numValue;
        updateRotateDisplay();
    }
});

updateOpacityDisplay();
updateZoomDisplay();
updateRotateDisplay();
updateSliderStates();
updateImageButton();

function clearBackgroundImage() {
    backgroundImage = null;
    backgroundImageData = null;
    bgImageInput.value = "";
    bgImagePanX = 0;
    bgImagePanY = 0;
    bgImageZoomInput.value = "1";
    updateZoomDisplay();
    bgImageOpacityInput.value = "0.3";
    updateOpacityDisplay();
    bgImageRotateInput.value = "0";
    updateRotateDisplay();
    updateSliderStates();
    updateImageButton();
    if (generatorImagePanel) {
        generatorImagePanel.innerHTML = "";
        generatorImagePanel.classList.remove("has-image");
    }
    drawCard();
}

function resetImagePosition() {
    bgImagePanX = 0;
    bgImagePanY = 0;
    drawCard();
}

[
    quote1Input,
    quote2Input,
    authorInput,
    quote1SizeInput,
    quote2SizeInput,
    authorSizeInput,
    quote1LineHeightInput,
    quote2LineHeightInput,
    quote1WeightInput,
    quote2WeightInput,
    authorWeightInput,
    quote1ColorInput,
    quote2ColorInput,
    authorColorInput,
    fontFamilyInput,
    cardWidthInput,
    cardHeightInput,
    bgColorInput,
    cardColorInput,
    dividerColorInput,
    showDividersInput,
    enableColoredBordersInput,
    enableQuote2ToggleInput,
].forEach((input) => {
    input.addEventListener("input", drawCard);
    input.addEventListener("change", drawCard);
});

function isMouseOverImage(mouseX, mouseY) {
    if (!backgroundImage) return false;

    const width = parseInt(cardWidthInput.value);
    const height = parseInt(cardHeightInput.value);
    const enableColoredBorders = enableColoredBordersInput.checked;
    const borderWidth = 5;
    const marginFromEdge = 38;

    const offset2 = enableColoredBorders
        ? marginFromEdge + borderWidth * 3
        : marginFromEdge;

    const cardInnerX = offset2 + borderWidth;
    const cardInnerY = offset2 + borderWidth;
    const cardInnerWidth = width - 2 * (offset2 + borderWidth);
    const cardInnerHeight = height - 2 * (offset2 + borderWidth);

    return (
        mouseX >= cardInnerX &&
        mouseX <= cardInnerX + cardInnerWidth &&
        mouseY >= cardInnerY &&
        mouseY <= cardInnerY + cardInnerHeight
    );
}

canvas.addEventListener("mousemove", (e) => {
    const mousePos = getMousePos(e);

    if (isDraggingImage) {
        const deltaX = mousePos.x - startX;
        const deltaY = mousePos.y - startY;
        bgImagePanX += deltaX;
        bgImagePanY += deltaY;
        startX = mousePos.x;
        startY = mousePos.y;
        drawCard();
        return;
    }

    if (isDragging && dragTarget) {
        const deltaY = mousePos.y - startY;

        if (dragTarget === "quote1") {
            quote1Offset += deltaY;
        } else if (dragTarget === "quote2") {
            quote2Offset += deltaY;
        } else if (dragTarget === "author") {
            authorOffset += deltaY;
        } else if (dragTarget === "divider1") {
            divider1Offset += deltaY;
        }

        startY = mousePos.y;
        drawCard();
        return;
    }

    const textUnderMouse = getTextUnderMouse(mousePos.x, mousePos.y);
    const overImage = isMouseOverImage(mousePos.x, mousePos.y);

    if (textUnderMouse) {
        canvas.style.cursor = "grab";
    } else if (overImage && backgroundImage) {
        canvas.style.cursor = "move";
    } else {
        canvas.style.cursor = "default";
    }
});

canvas.addEventListener("mousedown", (e) => {
    const mousePos = getMousePos(e);
    const textUnderMouse = getTextUnderMouse(mousePos.x, mousePos.y);

    if (textUnderMouse) {
        isDragging = true;
        dragTarget = textUnderMouse;
        startY = mousePos.y;
        canvas.style.cursor = "grabbing";
        e.preventDefault();
        return;
    }

    const overImage = isMouseOverImage(mousePos.x, mousePos.y);
    if (overImage && backgroundImage) {
        isDraggingImage = true;
        startX = mousePos.x;
        startY = mousePos.y;
        canvas.style.cursor = "move";
        e.preventDefault();
    }
});

canvas.addEventListener("mouseup", () => {
    isDragging = false;
    isDraggingImage = false;
    dragTarget = null;
    canvas.style.cursor = "default";
});

canvas.addEventListener("mouseleave", () => {
    isDragging = false;
    isDraggingImage = false;
    dragTarget = null;
    canvas.style.cursor = "default";
});

// Touch events for mobile
canvas.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mousePos = {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
    };

    const textUnderMouse = getTextUnderMouse(mousePos.x, mousePos.y);

    if (textUnderMouse) {
        isDragging = true;
        dragTarget = textUnderMouse;
        startY = mousePos.y;
        e.preventDefault();
        return;
    }

    const overImage = isMouseOverImage(mousePos.x, mousePos.y);
    if (overImage && backgroundImage) {
        isDraggingImage = true;
        startX = mousePos.x;
        startY = mousePos.y;
        e.preventDefault();
    }
});

canvas.addEventListener("touchmove", (e) => {
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mousePos = {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
    };

    if (isDraggingImage) {
        const deltaX = mousePos.x - startX;
        const deltaY = mousePos.y - startY;
        bgImagePanX += deltaX;
        bgImagePanY += deltaY;
        startX = mousePos.x;
        startY = mousePos.y;
        drawCard();
        e.preventDefault();
        return;
    }

    if (isDragging && dragTarget) {
        const deltaY = mousePos.y - startY;

        if (dragTarget === "quote1") {
            quote1Offset += deltaY;
        } else if (dragTarget === "quote2") {
            quote2Offset += deltaY;
        } else if (dragTarget === "author") {
            authorOffset += deltaY;
        } else if (dragTarget === "divider1") {
            divider1Offset += deltaY;
        }

        startY = mousePos.y;
        drawCard();
        e.preventDefault();
    }
});

canvas.addEventListener("touchend", () => {
    isDragging = false;
    isDraggingImage = false;
    dragTarget = null;
});

canvas.addEventListener("touchcancel", () => {
    isDragging = false;
    isDraggingImage = false;
    dragTarget = null;
});

// Resize handle functionality
const resizeHandle = document.getElementById("resizeHandle");
const dimensionLabel = document.getElementById("dimensionLabel");
let isResizing = false;
let resizeStartY, startWidth, startHeight;

resizeHandle.addEventListener("mousedown", (e) => {
    isResizing = true;
    startX = e.clientX;
    resizeStartY = e.clientY;
    startWidth = parseInt(cardWidthInput.value);
    startHeight = parseInt(cardHeightInput.value);
    dimensionLabel.classList.add("visible");
    dimensionLabel.textContent = `${startWidth} × ${startHeight}`;
    e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - resizeStartY;

    const newWidth = Math.max(400, Math.min(2000, startWidth + deltaX));
    const newHeight = Math.max(400, Math.min(2000, startHeight + deltaY));

    cardWidthInput.value = newWidth;
    cardHeightInput.value = newHeight;
    dimensionLabel.textContent = `${newWidth} × ${newHeight}`;
    drawCard();
});

document.addEventListener("mouseup", () => {
    if (isResizing) {
        dimensionLabel.classList.remove("visible");
    }
    isResizing = false;
});

// Flying pig animation
const flyingPig = document.getElementById("flyingPig");

function showLoveHeart(x, y) {
    const heart = document.createElement("div");
    heart.className = "love-heart";
    heart.textContent = "❤️";
    heart.style.left = x + "px";
    heart.style.top = y + "px";
    document.body.appendChild(heart);
    setTimeout(() => heart.remove(), 2000);
}

flyingPig.addEventListener("click", (e) => {
    e.stopPropagation();
    const rect = flyingPig.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2 - 30;
    const centerY = rect.top + rect.height / 2 - 30;
    showLoveHeart(centerX, centerY);
    flyingPig.style.animation = "bounce 0.3s ease";
    setTimeout(() => (flyingPig.style.animation = ""), 300);
});

function createRandomFlight() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const margin = 100;

    const startSide = Math.floor(Math.random() * 4);
    let startX, startY, endX, endY;

    switch (startSide) {
        case 0:
            startX = -margin;
            startY = Math.random() * screenHeight;
            endX = screenWidth + margin;
            endY = Math.random() * screenHeight;
            break;
        case 1:
            startX = Math.random() * screenWidth;
            startY = -margin;
            endX = Math.random() * screenWidth;
            endY = screenHeight + margin;
            break;
        case 2:
            startX = screenWidth + margin;
            startY = Math.random() * screenHeight;
            endX = -margin;
            endY = Math.random() * screenHeight;
            break;
        case 3:
            startX = Math.random() * screenWidth;
            startY = screenHeight + margin;
            endX = Math.random() * screenWidth;
            endY = -margin;
            break;
    }

    const duration = 15 + Math.random() * 5;

    flyingPig.style.left = startX + "px";
    flyingPig.style.top = startY + "px";
    flyingPig.style.transition = "none";
    flyingPig.style.transform = "rotate(0deg)";
    flyingPig.style.opacity = "0";

    void flyingPig.offsetWidth;

    flyingPig.style.transition = `left ${duration}s linear, top ${duration}s linear, transform ${duration}s linear, opacity 0.5s ease`;
    flyingPig.style.left = endX + "px";
    flyingPig.style.top = endY + "px";
    flyingPig.style.transform = "rotate(0deg)";
    flyingPig.style.opacity = "1";

    setTimeout(() => (flyingPig.style.opacity = "0"), (duration - 1) * 1000);
    setTimeout(createRandomFlight, duration * 1000 + 5000);
}

setTimeout(createRandomFlight, 1000);

// Template Management
function getCurrentTemplate() {
    return {
        bgColor: bgColorInput.value,
        cardColor: cardColorInput.value,
        dividerColor: dividerColorInput.value,
        quote1Color: quote1ColorInput.value,
        quote2Color: quote2ColorInput.value,
        authorColor: authorColorInput.value,
        fontFamily: fontFamilyInput.value,
        quote1Size: quote1SizeInput.value,
        quote2Size: quote2SizeInput.value,
        authorSize: authorSizeInput.value,
        quote1Weight: quote1WeightInput.value,
        quote2Weight: quote2WeightInput.value,
        authorWeight: authorWeightInput.value,
        quote1LineHeight: quote1LineHeightInput.value,
        quote2LineHeight: quote2LineHeightInput.value,
        cardWidth: cardWidthInput.value,
        cardHeight: cardHeightInput.value,
        quote1Offset: quote1Offset,
        quote2Offset: quote2Offset,
        authorOffset: authorOffset,
        divider1Offset: divider1Offset,
        enableQuote2: enableQuote2ToggleInput.checked,
        enableQuote2Toggle: enableQuote2ToggleInput.checked,
        enableColoredBorders: enableColoredBordersInput.checked,
        showDividers: showDividersInput.checked,
        previewBg: currentPreviewBg,
        backgroundImageData: backgroundImageData,
        bgImageOpacity: bgImageOpacityInput.value,
        bgImageZoom: bgImageZoomInput.value,
        bgImagePanX: bgImagePanX,
        bgImagePanY: bgImagePanY,
        quote1Text: quote1Input.value,
        quote2Text: quote2Input.value,
        authorText: authorInput.value,
    };
}

function applyTemplate(template) {
    bgColorInput.value = template.bgColor;
    cardColorInput.value = template.cardColor;
    dividerColorInput.value = template.dividerColor;
    quote1ColorInput.value = template.quote1Color;
    quote2ColorInput.value = template.quote2Color;
    authorColorInput.value = template.authorColor;

    fontFamilyInput.value = template.fontFamily;
    quote1SizeInput.value = template.quote1Size;
    quote2SizeInput.value = template.quote2Size;
    authorSizeInput.value = template.authorSize;
    quote1WeightInput.value = template.quote1Weight;
    quote2WeightInput.value = template.quote2Weight;
    authorWeightInput.value = template.authorWeight;
    quote1LineHeightInput.value = template.quote1LineHeight;
    quote2LineHeightInput.value = template.quote2LineHeight;

    cardWidthInput.value = template.cardWidth;
    cardHeightInput.value = template.cardHeight;

    quote1Offset = template.quote1Offset;
    quote2Offset = template.quote2Offset;
    authorOffset = template.authorOffset;
    divider1Offset = template.divider1Offset;

    enableQuote2ToggleInput.checked = template.enableQuote2Toggle;
    enableColoredBordersInput.checked = template.enableColoredBorders;
    if (template.showDividers !== undefined) {
        showDividersInput.checked = template.showDividers;
    }

    currentPreviewBg = template.previewBg || "light";
    darkBackgroundToggle.checked = template.previewBg === "dark";
    updatePreviewBackground();

    if (template.backgroundImageData) {
        backgroundImageData = template.backgroundImageData;
        const img = new Image();
        img.onload = () => {
            backgroundImage = img;
            updateSliderStates();
            drawCard();
            if (generatorImagePanel) {
                generatorImagePanel.classList.add("has-image");
                renderGeneratedPreview(template.backgroundImageData);
            }
        };
        img.src = template.backgroundImageData;
    } else {
        backgroundImage = null;
        backgroundImageData = null;
        updateSliderStates();
        if (generatorImagePanel) {
            generatorImagePanel.classList.remove("has-image");
            generatorImagePanel.innerHTML = "";
        }
    }

    bgImageOpacityInput.value = template.bgImageOpacity || 0.3;
    updateOpacityDisplay();
    bgImageZoomInput.value = template.bgImageZoom || 1;
    updateZoomDisplay();
    bgImagePanX = template.bgImagePanX || 0;
    bgImagePanY = template.bgImagePanY || 0;

    if (template.quote1Text !== undefined) {
        quote1Input.value = template.quote1Text;
    }
    if (template.quote2Text !== undefined) {
        quote2Input.value = template.quote2Text;
    }
    if (template.authorText !== undefined) {
        authorInput.value = template.authorText;
    }

    updatePreviewBackground();
    drawCard();
}

function saveTemplate() {
    const templateNameInput = document.getElementById("templateName");
    let name = templateNameInput.value.trim();

    let templates = JSON.parse(localStorage.getItem("quoteTemplates") || "[]");

    if (!name) {
        name = `Template ${templates.length + 1}`;
    }

    const existingIndex = templates.findIndex((t) => t.name === name);
    const template = {
        name: name,
        settings: getCurrentTemplate(),
        createdAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
        if (confirm(`Template "${name}" există deja. Vrei să-l suprascrieri?`)) {
            templates[existingIndex] = template;
        } else {
            return;
        }
    } else {
        templates.push(template);
    }

    localStorage.setItem("quoteTemplates", JSON.stringify(templates));
    templateNameInput.value = "";
    loadTemplateList();
}

function loadTemplateList() {
    const templates = JSON.parse(localStorage.getItem("quoteTemplates") || "[]");
    const listContainer = document.getElementById("templateList");

    if (templates.length === 0) {
        listContainer.innerHTML =
            '<div class="empty-templates">No saved templates</div>';
        return;
    }

    listContainer.innerHTML = templates
        .map(
            (template, index) => `
    <div class="template-item">
      <div class="template-name" onclick="applyTemplateByIndex(${index})" title="Click pentru a aplica">
        ${template.name}
      </div>
      <div class="template-actions">
        <button class="template-btn apply-btn" onclick="applyTemplateByIndex(${index})" title="Aplică">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="template-btn delete-btn" onclick="deleteTemplate(${index})" title="Șterge">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 4H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M6 4V2.5C6 2.22386 6.22386 2 6.5 2H9.5C9.77614 2 10 2.22386 10 2.5V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M3 4V13C3 13.5523 3.44772 14 4 14H12C12.5523 14 13 13.5523 13 13V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M6.5 7V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M9.5 7V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  `
        )
        .join("");
}

function applyTemplateByIndex(index) {
    const templates = JSON.parse(localStorage.getItem("quoteTemplates") || "[]");
    if (templates[index]) {
        applyTemplate(templates[index].settings);
    }
}

function deleteTemplate(index) {
    const templates = JSON.parse(localStorage.getItem("quoteTemplates") || "[]");
    if (templates[index]) {
        if (confirm(`Ștergi template-ul "${templates[index].name}"?`)) {
            templates.splice(index, 1);
            localStorage.setItem("quoteTemplates", JSON.stringify(templates));
            loadTemplateList();
        }
    }
}

// Initial draw
updatePreviewBackground();
drawCard();
loadTemplateList();

