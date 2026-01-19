<template>
  <div v-if="total > 0 || pageSizeOptions.length" class="pagination">
    <div class="pagination-info">
      {{ t("pagination.info", { start: startItem, end: endItem, total }) }}
    </div>
    <div class="pagination-controls">
      <div v-if="pageSizeOptions.length" class="pagination-size">
        <span class="pagination-label">{{ t("pagination.perPage") }}</span>
        <select v-model="currentPageSize" class="select">
          <option v-for="option in pageSizeOptions" :key="String(option)" :value="String(option)">
            {{ optionLabel(option) }}
          </option>
        </select>
      </div>
      <button class="btn btn-ghost" type="button" :disabled="page <= 1" @click="goTo(page - 1)">
        {{ t("pagination.prev") }}
      </button>
      <span class="pagination-page">
        {{ t("pagination.page", { page, totalPages }) }}
      </span>
      <button class="btn btn-ghost" type="button" :disabled="page >= totalPages" @click="goTo(page + 1)">
        {{ t("pagination.next") }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { t } from "../services/i18n.js";

const props = defineProps({
  page: {
    type: Number,
    required: true
  },
  pageSize: {
    type: [Number, String],
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  pageSizeOptions: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(["update:page", "update:pageSize"]);

const isAll = computed(() => String(props.pageSize).toLowerCase() === "all");
const numericPageSize = computed(() => (isAll.value ? props.total || 0 : Number(props.pageSize)));
const totalPages = computed(() => {
  if (props.total === 0 || isAll.value) return 1;
  return Math.max(1, Math.ceil(props.total / Math.max(numericPageSize.value, 1)));
});
const startItem = computed(() => {
  if (props.total === 0) return 0;
  if (isAll.value) return 1;
  return (props.page - 1) * numericPageSize.value + 1;
});
const endItem = computed(() => {
  if (props.total === 0) return 0;
  if (isAll.value) return props.total;
  return Math.min(props.total, props.page * numericPageSize.value);
});

const currentPageSize = computed({
  get: () => String(props.pageSize),
  set: (value) => {
    const next = value === "all" ? "all" : Number.parseInt(value, 10);
    emit("update:pageSize", Number.isFinite(next) ? next : "all");
  }
});

const optionLabel = (option) => (String(option).toLowerCase() === "all" ? t("pagination.all") : option);

const goTo = (nextPage) => {
  const clamped = Math.min(Math.max(nextPage, 1), totalPages.value);
  if (clamped !== props.page) {
    emit("update:page", clamped);
  }
};
</script>
