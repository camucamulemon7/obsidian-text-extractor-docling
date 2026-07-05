<script lang="ts">
  import MultiSelect from 'svelte-multiselect'
  import { OCR_LANGUAGES, selectedLanguages } from '../settings'
</script>

<div class="text-extract-language-selector">
  <MultiSelect
    bind:selected={$selectedLanguages}
    options={OCR_LANGUAGES}
    placeholder="Select OCR languages…" />
</div>

<style>
  .text-extract-language-selector {
    width: min(34rem, 100%);
  }

  .text-extract-language-selector :global(div.multiselect) {
    color: var(--text-normal);
    border: var(--input-border-width) solid var(--background-modifier-border);
    background-color: var(--background-secondary);
  }

  .text-extract-language-selector :global(div.multiselect > ul.options) {
    max-height: 18rem;
    background-color: var(--background-secondary);
  }

  .text-extract-language-selector :global(div.multiselect button) {
    border-radius: var(--radius-s);
  }

  .text-extract-language-selector :global(button:not(.clickable-icon)) {
    background-color: transparent;
    box-shadow: none;
  }
</style>
