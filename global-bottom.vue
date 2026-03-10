<script setup lang="ts">
import { useNav } from "@slidev/client";
import { computed } from "vue";

const { currentPage } = useNav();

const sections = [
  { number: 1, name: "Intro", start: 1, end: 3 },
  { number: 2, name: "Nix vs NixOS vs nixpkgs", start: 4, end: 5 },
  { number: 3, name: "Language Basics", start: 6, end: 9 },
  { number: 4, name: "devShell", start: 10, end: 11 },
  { number: 5, name: "Lazy Evaluation", start: 12, end: 13 },
  { number: 6, name: "Module System + Configurations", start: 14, end: 17 },
  { number: 7, name: "VM Tests", start: 18, end: 19 },
  { number: 8, name: "Substituters", start: 20, end: 21 },
  { number: 9, name: "Useful Embedded Packaging Patterns", start: 22, end: 24 },
  { number: 10, name: "Introspection", start: 25, end: 27 },
];

const activeSection = computed(
  () =>
    sections.findIndex(
      (section) =>
        currentPage.value >= section.start && currentPage.value <= section.end,
    ) ?? -1,
);

const visibleSectionCount = 5;

const sectionWindow = computed(() => {
  const pivot = activeSection.value >= 0 ? activeSection.value : 0;
  const half = Math.floor(visibleSectionCount / 2);
  const maxStart = Math.max(0, sections.length - visibleSectionCount);
  const start = Math.min(maxStart, Math.max(0, pivot - half));
  const end = Math.min(sections.length, start + visibleSectionCount);

  return {
    end,
    start,
  };
});

const footerTokens = computed(() => {
  const tokens: Array<
    | { kind: "ellipsis"; key: string; label: string }
    | { kind: "section"; key: string; index: number; label: string }
  > = [];

  if (sectionWindow.value.start > 0) {
    tokens.push({ kind: "ellipsis", key: "left", label: "..." });
  }

  for (
    let index = sectionWindow.value.start;
    index < sectionWindow.value.end;
    index += 1
  ) {
    tokens.push({
      kind: "section",
      key: sections[index].name,
      index,
      label: `${sections[index].number}. ${sections[index].name}`,
    });
  }

  if (sectionWindow.value.end < sections.length) {
    tokens.push({ kind: "ellipsis", key: "right", label: "..." });
  }

  return tokens;
});
</script>

<template>
  <footer class="section-footer">
    <template v-for="(token, tokenIndex) in footerTokens" :key="token.key">
      <span
        :class="{
          active: token.kind === 'section' && token.index === activeSection,
          ellipsis: token.kind === 'ellipsis',
        }"
      >
        {{ token.label }}
      </span>
      <span v-if="tokenIndex < footerTokens.length - 1" class="sep">|</span>
    </template>
  </footer>
</template>

<style scoped>
.section-footer {
  position: fixed;
  right: 2.5rem;
  bottom: 0.9rem;
  left: 2.5rem;
  display: flex;
  gap: 0.55rem;
  justify-content: center;
  align-items: center;
  padding: 0.3rem 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.13);
  background: rgba(6, 10, 14, 0.54);
  backdrop-filter: blur(2px);
  font-size: 0.66rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  pointer-events: none;
}

.section-footer span {
  opacity: 0.3;
  white-space: nowrap;
}

.section-footer span.ellipsis {
  opacity: 0.45;
}

.section-footer span.active {
  opacity: 1;
  font-weight: 700;
}

.section-footer .sep {
  opacity: 0.6;
}
</style>
