<script setup lang="ts">
import { ref } from "vue";

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

const props = defineProps<{
  actions: Action[];
  description: string;
  title: string;
}>();

const activeAction = ref<string | null>(null);
const lastResult = ref<DemoResult | null>(null);
const errorMessage = ref<string | null>(null);

const serverOrigin = () => {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:4242";
  }

  return `http://${window.location.hostname || "127.0.0.1"}:4242`;
};

const runAction = async (action: Action) => {
  activeAction.value = action.id;
  errorMessage.value = null;

  try {
    const response = await fetch(`${serverOrigin()}/api/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: action.id }),
    });

    const payload = (await response.json()) as DemoResult | { error: string };

    if (!response.ok || "error" in payload) {
      throw new Error("error" in payload ? payload.error : "request failed");
    }

    lastResult.value = payload;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "unknown demo error";
  } finally {
    activeAction.value = null;
  }
};
</script>

<template>
  <section class="demo-shell">
    <header class="demo-header">
      <div>
        <p class="demo-eyebrow">Interactive Slide</p>
        <h3>{{ title }}</h3>
      </div>
      <p class="demo-description">{{ description }}</p>
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

      <pre>{{ lastResult?.output ?? "No output yet." }}</pre>
    </div>
  </section>
</template>

<style scoped>
.demo-shell {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
  padding: 1.2rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(12, 17, 21, 0.82);
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

.demo-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
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
}

.demo-output-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: #f6b84f;
  font-size: 0.9rem;
}

.demo-output pre {
  min-height: 16rem;
  margin: 0;
  padding: 1rem;
  overflow: auto;
  background: rgba(4, 8, 11, 0.88);
  color: #d8f3dc;
  font-size: 0.84rem;
  line-height: 1.45;
}

@media (max-width: 900px) {
  .demo-actions {
    grid-template-columns: 1fr;
  }
}
</style>
