<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

type Action = {
  id: string;
  label: string;
  hint?: string;
};

type DemoResult = {
  command: string;
  durationMs: number;
  exitCode: number;
  ok: boolean;
  output: string;
};

type DemoStartPayload = {
  command: string;
  scriptPath: string;
  scriptSource: string;
};

const props = defineProps<{
  actions: Action[];
  buttonLabel?: string;
  description: string;
  mode?: "inline" | "modal";
  title: string;
}>();

const activeAction = ref<string | null>(null);
const lastResult = ref<DemoResult | null>(null);
const errorMessage = ref<string | null>(null);
const liveOutput = ref("");
const isOpen = ref(false);
const shellCommand = ref("");
const scriptPath = ref("");
const scriptSource = ref("");
const demoRoot = ref<HTMLElement | null>(null);
const modalStyle = ref<Record<string, string>>({});
const backdropStyle = ref<Record<string, string>>({});
const isModalMode = computed(() => props.mode === "modal");
const launchButtonLabel = computed(
  () => props.buttonLabel ?? "Explore / Interact",
);

const serverOrigin = () => {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:4242";
  }

  return `http://${window.location.hostname || "127.0.0.1"}:4242`;
};

const runAction = async (action: Action) => {
  activeAction.value = action.id;
  errorMessage.value = null;
  liveOutput.value = "";
  lastResult.value = null;
  shellCommand.value = "";
  scriptPath.value = "";
  scriptSource.value = "";

  try {
    const url = new URL(`${serverOrigin()}/api/run-stream`);
    url.searchParams.set("action", action.id);

    const eventSource = new EventSource(url.toString());

    await new Promise<void>((resolve, reject) => {
      eventSource.addEventListener("start", (event) => {
        const payload = JSON.parse(
          (event as MessageEvent).data,
        ) as DemoStartPayload;

        lastResult.value = {
          command: payload.command,
          durationMs: 0,
          exitCode: 0,
          ok: false,
          output: "",
        };
        shellCommand.value = payload.command;
        scriptPath.value = payload.scriptPath;
        scriptSource.value = payload.scriptSource;
      });

      eventSource.addEventListener("stdout", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          chunk: string;
        };
        liveOutput.value += payload.chunk;
      });

      eventSource.addEventListener("stderr", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          chunk: string;
        };
        liveOutput.value += `[stderr] ${payload.chunk}`;
      });

      eventSource.addEventListener("exit", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as DemoResult;
        lastResult.value = payload;
        if (liveOutput.value.trim().length === 0) {
          liveOutput.value = payload.output;
        }

        eventSource.close();
        resolve();
      });

      eventSource.onerror = async () => {
        eventSource.close();

        try {
          const fallback = await fetch(`${serverOrigin()}/api/run`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ action: action.id }),
          });
          const payload = (await fallback.json()) as
            | DemoResult
            | { error: string };

          if (!fallback.ok || "error" in payload) {
            throw new Error(
              "error" in payload
                ? payload.error
                : "request failed (restart scripts/present)",
            );
          }

          lastResult.value = payload;
          shellCommand.value = payload.command;
          liveOutput.value = payload.output;
          resolve();
        } catch (error) {
          reject(error);
        }
      };
    });
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "unknown demo error";
  } finally {
    activeAction.value = null;
  }
};

const closeModal = () => {
  if (activeAction.value !== null) {
    return;
  }

  isOpen.value = false;
};

const updateModalGeometry = () => {
  const page = demoRoot.value?.closest(".slidev-page") as HTMLElement | null;
  if (!page) {
    return;
  }

  const pageContent =
    (page.querySelector(".slidev-page-content") as HTMLElement | null) ?? page;
  const rect = pageContent.getBoundingClientRect();

  const width = Math.round(
    Math.min(Math.max(rect.width * 0.8, 640), window.innerWidth * 0.9),
  );
  const height = Math.round(
    Math.min(Math.max(rect.height * 0.8, 420), window.innerHeight * 0.9),
  );
  const left = Math.round(rect.left + (rect.width - width) / 2);
  const top = Math.round(rect.top + (rect.height - height) / 2);

  backdropStyle.value = {
    left: `${Math.round(rect.left)}px`,
    top: `${Math.round(rect.top)}px`,
    width: `${Math.round(rect.width)}px`,
    height: `${Math.round(rect.height)}px`,
  };

  modalStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  };
};

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    closeModal();
  }
};

onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", updateModalGeometry);
  window.addEventListener("scroll", updateModalGeometry, true);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("resize", updateModalGeometry);
  window.removeEventListener("scroll", updateModalGeometry, true);
});

watch(isOpen, async (open) => {
  if (!open || !isModalMode.value) {
    return;
  }

  await nextTick();
  updateModalGeometry();
});
</script>

<template>
  <div ref="demoRoot" class="demo-root">
    <button
      v-if="isModalMode"
      class="demo-launch"
      type="button"
      @click="isOpen = true"
    >
      {{ launchButtonLabel }}
    </button>

    <section v-if="!isModalMode" class="demo-shell">
      <header class="demo-header">
        <div>
          <p class="demo-eyebrow">Interactive Slide</p>
          <h3>{{ title }}</h3>
        </div>
        <p class="demo-description">{{ description }}</p>
        <button
          v-if="isModalMode"
          aria-label="Close interactive modal"
          class="demo-close"
          type="button"
          @click="closeModal"
        >
          ×
        </button>
      </header>

      <div class="demo-actions">
        <button
          v-for="action in props.actions"
          :key="action.id"
          :disabled="activeAction !== null"
          class="demo-button"
          type="button"
          @click="runAction(action)"
        >
          <span>{{ action.label }}</span>
          <small v-if="action.hint">{{ action.hint }}</small>
        </button>
      </div>

      <p v-if="errorMessage" class="demo-error">
        {{ errorMessage }}
      </p>

      <div class="demo-output">
        <div class="demo-output-meta">
          <span v-if="activeAction">Running {{ activeAction }}...</span>
          <template v-else-if="lastResult">
            <span>{{ lastResult.command }}</span>
            <span>exit {{ lastResult.exitCode }}</span>
            <span>{{ lastResult.durationMs }} ms</span>
          </template>
          <span v-else>Pick a button to run a live Nix-backed demo.</span>
        </div>

        <div class="demo-shell-view">
          <p class="demo-shell-title">Command</p>
          <pre class="demo-shell-command">
$ {{ shellCommand || "waiting for action..." }}</pre
          >
          <p v-if="scriptPath" class="demo-shell-title">
            Script: {{ scriptPath }}
          </p>
          <pre v-if="scriptSource" class="demo-shell-source">{{
            scriptSource
          }}</pre>
        </div>

        <pre>{{ liveOutput || "No output yet." }}</pre>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="isModalMode && isOpen"
        class="demo-backdrop"
        :style="backdropStyle"
        @click="closeModal"
      />

      <section
        v-if="isModalMode && isOpen"
        class="demo-shell demo-shell-modal"
        :style="modalStyle"
      >
        <header class="demo-header">
          <div>
            <p class="demo-eyebrow">Interactive Slide</p>
            <h3>{{ title }}</h3>
          </div>
          <p class="demo-description">{{ description }}</p>
          <button
            aria-label="Close interactive modal"
            class="demo-close"
            type="button"
            @click="closeModal"
          >
            ×
          </button>
        </header>

        <div class="demo-actions">
          <button
            v-for="action in props.actions"
            :key="action.id"
            :disabled="activeAction !== null"
            class="demo-button"
            type="button"
            @click="runAction(action)"
          >
            <span>{{ action.label }}</span>
            <small v-if="action.hint">{{ action.hint }}</small>
          </button>
        </div>

        <p v-if="errorMessage" class="demo-error">
          {{ errorMessage }}
        </p>

        <div class="demo-output">
          <div class="demo-output-meta">
            <span v-if="activeAction">Running {{ activeAction }}...</span>
            <template v-else-if="lastResult">
              <span>{{ lastResult.command }}</span>
              <span>exit {{ lastResult.exitCode }}</span>
              <span>{{ lastResult.durationMs }} ms</span>
            </template>
            <span v-else>Pick a button to run a live Nix-backed demo.</span>
          </div>

          <div class="demo-shell-view">
            <p class="demo-shell-title">Command</p>
            <pre class="demo-shell-command">
$ {{ shellCommand || "waiting for action..." }}</pre
            >
            <p v-if="scriptPath" class="demo-shell-title">
              Script: {{ scriptPath }}
            </p>
            <pre v-if="scriptSource" class="demo-shell-source">{{
              scriptSource
            }}</pre>
          </div>

          <pre>{{ liveOutput || "No output yet." }}</pre>
        </div>
      </section>
    </Teleport>
  </div>
</template>

<style scoped>
.demo-root {
  margin-top: 1rem;
  margin-bottom: 2.4rem;
}

.demo-backdrop {
  position: fixed;
  z-index: 70;
  inset: 0;
  background: rgba(0, 0, 0, 0.64);
}

.demo-shell {
  display: grid;
  gap: 1rem;
  padding: 1.2rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(12, 17, 21, 0.82);
}

.demo-shell-modal {
  position: fixed;
  z-index: 80;
  margin: 0;
  overflow: hidden;
  grid-template-rows: auto auto 1fr;
  border: 2px solid rgba(246, 184, 79, 0.75);
  transform: none;
  box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.45);
}

.demo-header {
  display: grid;
  gap: 0.4rem;
}

.demo-header h3 {
  margin: 0;
  font-size: 1.35rem;
}

.demo-eyebrow {
  margin: 0;
  color: #f6b84f;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.demo-description {
  margin: 0;
  color: #c9d1cc;
}

.demo-launch {
  padding: 0.75rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #f7f6f2;
  cursor: pointer;
}

.demo-close {
  justify-self: end;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: #f7f6f2;
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
}

.demo-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
}

.demo-shell-modal .demo-actions {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.demo-button {
  display: grid;
  gap: 0.35rem;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #f7f6f2;
  text-align: left;
  cursor: pointer;
}

.demo-button:disabled {
  opacity: 0.65;
  cursor: wait;
}

.demo-button small {
  color: #c9d1cc;
  line-height: 1.3;
}

.demo-error {
  margin: 0;
  color: #ffb4a2;
}

.demo-output {
  display: grid;
  gap: 0.7rem;
  min-height: 0;
  grid-template-rows: auto auto 1fr;
}

.demo-output-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: #f6b84f;
  font-size: 0.9rem;
}

.demo-output pre {
  min-height: 0;
  margin: 0;
  padding: 1rem;
  overflow: auto;
  background: rgba(4, 8, 11, 0.88);
  color: #d8f3dc;
  font-size: 0.84rem;
  line-height: 1.45;
}

.demo-shell-view {
  display: grid;
  gap: 0.4rem;
}

.demo-shell-title {
  margin: 0;
  color: #f6b84f;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.demo-shell-command {
  margin: 0;
  padding: 0.65rem 0.8rem;
  background: rgba(7, 12, 16, 0.9);
  color: #cfe4ce;
  font-size: 0.8rem;
}

.demo-shell-source {
  max-height: 8rem;
  margin: 0;
  padding: 0.7rem 0.8rem;
  overflow: auto;
  background: rgba(7, 12, 16, 0.9);
  color: #c9d1cc;
  font-size: 0.76rem;
  line-height: 1.35;
}

@media (max-width: 900px) {
  .demo-actions {
    grid-template-columns: 1fr;
  }
}
</style>
