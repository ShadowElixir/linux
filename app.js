const SHADOW_CONFIG = {
    github: {
        owner: "ShadowElixir",
        repo: "shadowos-linux",
        workflowFile: "build-iso.yml"
    }
};

const runtimeState = {
    de: null,
    gpu: null,
    steam: null,
    channel: null,
    liveData: {
        suiteId: null,
        artifacts: {}
    }
};

document.addEventListener("DOMContentLoaded", () => {
    initializeUIEventListeners();
    fetchLatestArtifacts();
});

function initializeUIEventListeners() {
    document.querySelectorAll(".selector-grid button").forEach(button => {
        button.addEventListener("click", e => {
            const currentButton = e.currentTarget;
            const parentGrid = currentButton.parentElement;
            const matrixStep = parentGrid.getAttribute("data-step");
            const elementValue = currentButton.getAttribute("data-value");

            parentGrid.querySelectorAll("button").forEach(btn => {
                btn.classList.remove("active");
            });

            currentButton.classList.add("active");

            if (matrixStep === "de") {
                runtimeState.de = elementValue;
            }

            if (matrixStep === "gpu") {
                runtimeState.gpu = elementValue;
            }

            if (matrixStep === "steam") {
                runtimeState.steam = elementValue;
            }

            if (matrixStep === "channel") {
                runtimeState.channel = elementValue;
            }

            evaluateShadowPipeline();
        });
    });
}

async function fetchLatestArtifacts() {
    const { owner, repo, workflowFile } = SHADOW_CONFIG.github;

    const runUrl =
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs?status=success&per_page=1`;

    try {
        const runResponse = await fetch(runUrl);

        if (!runResponse.ok) {
            throw new Error(
                `Workflow API responded with status: ${runResponse.status}`
            );
        }

        const runData = await runResponse.json();

        if (!runData.workflow_runs || runData.workflow_runs.length === 0) {
            throw new Error("No successful runs discovered in history.");
        }

        const latestRun = runData.workflow_runs[0];
        const runId = latestRun.id.toString();

        runtimeState.liveData.suiteId =
            latestRun.check_suite_id.toString();

        const artifactsUrl =
            `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/artifacts?per_page=100`;

        const artifactResponse = await fetch(artifactsUrl);

        if (!artifactResponse.ok) {
            throw new Error(
                `Artifacts sub-API dropped: ${artifactResponse.status}`
            );
        }

        const artifactData = await artifactResponse.json();

        if (!artifactData.artifacts || artifactData.artifacts.length === 0) {
            throw new Error("Run log contains no archived zip payloads.");
        }

        runtimeState.liveData.artifacts = {};

        artifactData.artifacts.forEach(item => {
            const fileName = item.name;
            const internalArtifactId = item.id.toString();

            const prefixMatch = fileName.match(
                /^(shadowos-[a-z-]+?)-f\d+/
            );

            if (prefixMatch) {
                const variantKey = prefixMatch[1];

                runtimeState.liveData.artifacts[variantKey] = {
                    name: fileName,
                    id: internalArtifactId
                };
            }
        });

        console.log(
            `Pipeline Indexed! Suite ID: ${runtimeState.liveData.suiteId}`
        );

        console.log(
            `Indexed ${Object.keys(runtimeState.liveData.artifacts).length} artifacts.`
        );

        console.log(
            "Available variants:",
            Object.keys(runtimeState.liveData.artifacts)
        );

        evaluateShadowPipeline();

    } catch (error) {
        console.error(
            "Failed to sync remote artifact tree:",
            error
        );
    }
}

function evaluateShadowPipeline() {
    const stepGpu = document.getElementById("step-gpu");
    const stepSteam = document.getElementById("step-steam");
    const stepChannel = document.getElementById("step-channel");
    const finalDownload = document.getElementById("final-download");
    const downloadBtn = document.querySelector(
        ".dynamic-download-trigger"
    );

    if (runtimeState.de !== null && stepGpu) {
        stepGpu.classList.add("visible");
    }

    if (
        runtimeState.de !== null &&
        runtimeState.gpu !== null &&
        stepSteam
    ) {
        stepSteam.classList.add("visible");
    }

    if (
        runtimeState.de !== null &&
        runtimeState.gpu !== null &&
        runtimeState.steam !== null &&
        stepChannel
    ) {
        stepChannel.classList.add("visible");
    }

    if (
        runtimeState.de !== null &&
        runtimeState.gpu !== null &&
        runtimeState.steam !== null &&
        runtimeState.channel !== null
    ) {
        const { owner, repo } = SHADOW_CONFIG.github;

        const variantTarget =
            `shadowos-${runtimeState.de}` +
            `${runtimeState.gpu}` +
            `${runtimeState.steam}` +
            `${runtimeState.channel}`;

        console.log("Looking for artifact:", variantTarget);

        if (
            !runtimeState.liveData.suiteId ||
            Object.keys(runtimeState.liveData.artifacts).length === 0
        ) {
            if (downloadBtn) {
                downloadBtn.removeAttribute("href");
                downloadBtn.style.pointerEvents = "none";
                downloadBtn.style.opacity = "0.4";
            }

            if (finalDownload) {
                finalDownload.classList.add("visible");
            }

            return;
        }

        const matchedArtifact =
            runtimeState.liveData.artifacts[variantTarget];

        if (matchedArtifact) {
            if (downloadBtn) {
                downloadBtn.href =
                    `https://nightly.link/${owner}/${repo}` +
                    `/suites/${runtimeState.liveData.suiteId}` +
                    `/artifacts/${matchedArtifact.id}`;

                downloadBtn.style.pointerEvents = "auto";
                downloadBtn.style.opacity = "1";
            }

            console.log(
                "Matched artifact:",
                matchedArtifact.name
            );
        } else {
            if (downloadBtn) {
                downloadBtn.removeAttribute("href");
                downloadBtn.style.pointerEvents = "none";
                downloadBtn.style.opacity = "0.15";
            }

            console.warn(
                `No artifact found for variant: ${variantTarget}`
            );
        }

        if (finalDownload) {
            finalDownload.classList.add("visible");
        }

    } else {
        if (finalDownload) {
            finalDownload.classList.remove("visible");
        }
    }
}
