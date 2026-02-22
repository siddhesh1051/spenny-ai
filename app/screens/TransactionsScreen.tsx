import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Alert,
  FlatList,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { useTheme } from "../context/ThemeContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { Badge } from "../components/ui/Badge";
import {
  Search,
  Edit,
  Trash2,
  Download,
  X,
  ChevronDown,
  Filter,
  Check,
  Calendar,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react-native";
import Toast from "react-native-toast-message";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";

const CATEGORIES: Record<string, string> = {
  food: "🍔",
  travel: "✈️",
  groceries: "🛒",
  entertainment: "🎉",
  utilities: "💡",
  rent: "🏠",
  other: "🤷",
};

const ALL_CATEGORIES = ["all", ...Object.keys(CATEGORIES)];

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
}

interface TransactionsScreenProps {
  expenses: Expense[];
  isLoading: boolean;
  deleteExpense: (id: string) => Promise<void>;
  updateExpense: (id: string, fields: Partial<Expense>) => Promise<void>;
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type ExportPreset = "last7" | "last30" | "last90" | "thisMonth" | "custom";

function getPresetRange(preset: ExportPreset, customFrom: Date | null, customTo: Date | null): { from: Date; to: Date } {
  const today = new Date();
  if (preset === "last7") return { from: subDays(today, 6), to: today };
  if (preset === "last30") return { from: subDays(today, 29), to: today };
  if (preset === "last90") return { from: subDays(today, 89), to: today };
  if (preset === "thisMonth") return { from: startOfMonth(today), to: endOfMonth(today) };
  return { from: customFrom ?? subDays(today, 29), to: customTo ?? today };
}

export default function TransactionsScreen({
  expenses,
  isLoading,
  deleteExpense,
  updateExpense,
}: TransactionsScreenProps) {
  const { colors, isDark } = useTheme();

  // --- List filters ---
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Date picker (list filter)
  const [showDatePicker, setShowDatePicker] = useState<"from" | "to" | null>(null);

  // --- Edit modal ---
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // --- Export modal ---
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStep, setExportStep] = useState<1 | 2>(1);
  const [exportPreset, setExportPreset] = useState<ExportPreset>("last30");
  const [exportCustomFrom, setExportCustomFrom] = useState<Date | null>(null);
  const [exportCustomTo, setExportCustomTo] = useState<Date | null>(null);
  const [showExportDatePicker, setShowExportDatePicker] = useState<"from" | "to" | null>(null);
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf" | null>(null);
  const [exporting, setExporting] = useState(false);

  // ------- Filtered list -------
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchSearch =
        !searchQuery.trim() ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.amount.toString().includes(searchQuery.trim());
      const matchCat = categoryFilter === "all" || e.category === categoryFilter;
      const d = new Date(e.date);
      const matchFrom = !dateFrom || d >= new Date(format(dateFrom, "yyyy-MM-dd") + "T00:00:00");
      const matchTo = !dateTo || d <= new Date(format(dateTo, "yyyy-MM-dd") + "T23:59:59");
      return matchSearch && matchCat && matchFrom && matchTo;
    });
  }, [expenses, searchQuery, categoryFilter, dateFrom, dateTo]);

  const totalFiltered = filteredExpenses.reduce((a, e) => a + e.amount, 0);
  const hasFilters = !!(searchQuery || categoryFilter !== "all" || dateFrom || dateTo);

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setDateFrom(null);
    setDateTo(null);
  };

  // ------- Export helpers -------
  const getExportList = useCallback(() => {
    const { from, to } = getPresetRange(exportPreset, exportCustomFrom, exportCustomTo);
    const fromMs = new Date(format(from, "yyyy-MM-dd") + "T00:00:00").getTime();
    const toMs = new Date(format(to, "yyyy-MM-dd") + "T23:59:59").getTime();
    return expenses.filter((e) => {
      const ms = new Date(e.date).getTime();
      return ms >= fromMs && ms <= toMs;
    });
  }, [expenses, exportPreset, exportCustomFrom, exportCustomTo]);

  const exportList = useMemo(() => getExportList(), [getExportList]);

  const openExportModal = () => {
    setExportStep(1);
    setExportFormat(null);
    setExportPreset("last30");
    setExportCustomFrom(null);
    setExportCustomTo(null);
    setIsExportModalOpen(true);
  };

  const handleExportCSV = async () => {
    const list = exportList;
    if (list.length === 0) { Toast.show({ type: "error", text1: "No transactions in range." }); return; }
    setExporting(true);
    try {
      const { from, to } = getPresetRange(exportPreset, exportCustomFrom, exportCustomTo);
      const headers = "Date,Description,Category,Amount (INR)\n";
      const rows = list
        .map((e) => `${fmt(e.date)},"${(e.description || "").replace(/"/g, '""')}",${e.category},${e.amount.toFixed(2)}`)
        .join("\n");
      const csv = "\uFEFF" + headers + rows; // BOM for Excel UTF-8 detection
      const fileName = `expenses_${format(from, "yyyy-MM-dd")}_to_${format(to, "yyyy-MM-dd")}.csv`;
      const fileUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Share Expenses CSV", UTI: "public.comma-separated-values-text" });
      } else {
        Toast.show({ type: "error", text1: "Sharing not available on this device." });
      }
      setIsExportModalOpen(false);
      Toast.show({ type: "success", text1: "CSV ready!" });
    } catch (e: any) {
      Toast.show({ type: "error", text1: "Failed to export CSV", text2: e.message });
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    const list = exportList;
    if (list.length === 0) { Toast.show({ type: "error", text1: "No transactions in range." }); return; }
    setExporting(true);
    try {
      const { from, to } = getPresetRange(exportPreset, exportCustomFrom, exportCustomTo);
      const total = list.reduce((a, e) => a + e.amount, 0);
      const rows = list.map((e) => `
        <tr>
          <td>${fmt(e.date)}</td>
          <td>${(e.description || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>
          <td style="text-transform:capitalize">${e.category}</td>
          <td style="text-align:right;font-weight:600">₹${e.amount.toFixed(2)}</td>
        </tr>`).join("");

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8"/>
          <style>
            body { font-family: -apple-system, Helvetica, sans-serif; padding: 32px; color: #09090b; }
            h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
            .meta { font-size: 13px; color: #71717a; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th { text-align: left; padding: 8px 10px; background: #f4f4f5; font-weight: 600; border-bottom: 1px solid #e4e4e7; }
            td { padding: 8px 10px; border-bottom: 1px solid #f4f4f5; }
            tr:last-child td { border-bottom: none; }
            .total-row { font-weight: 700; background: #f9f9f9; }
          </style>
        </head>
        <body>
          <h1>Expense Report</h1>
          <p class="meta">${format(from, "dd MMM yyyy")} – ${format(to, "dd MMM yyyy")} · ${list.length} transaction${list.length !== 1 ? "s" : ""}</p>
          <table>
            <thead>
              <tr><th>Date</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr>
            </thead>
            <tbody>
              ${rows}
              <tr class="total-row">
                <td colspan="3" style="text-align:right;padding-right:10px">Total</td>
                <td style="text-align:right;font-weight:700">₹${total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share Expense PDF" });
      } else {
        Toast.show({ type: "error", text1: "Sharing not available on this device." });
      }
      setIsExportModalOpen(false);
      Toast.show({ type: "success", text1: "PDF ready!" });
    } catch (e: any) {
      Toast.show({ type: "error", text1: "Failed to generate PDF", text2: e.message });
    } finally {
      setExporting(false);
    }
  };

  const handleExportDownload = () => {
    if (exportFormat === "csv") handleExportCSV();
    else if (exportFormat === "pdf") handleExportPDF();
  };

  // ------- Edit -------
  const handleEditSave = async () => {
    if (!editingExpense) return;
    await updateExpense(editingExpense.id, {
      amount: editingExpense.amount,
      category: editingExpense.category,
      description: editingExpense.description,
    });
    setIsEditModalOpen(false);
    setEditingExpense(null);
    Toast.show({ type: "success", text1: "Transaction updated!" });
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Transaction", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteExpense(id) },
    ]);
  };

  // ------- Expense row -------
  const renderExpenseItem = ({ item }: { item: Expense }) => (
    <Card style={{ ...(styles.expenseCard as object), borderColor: colors.cardBorder } as any}>
      <View style={styles.expenseHeader}>
        <View style={styles.expenseInfo}>
          <Text style={[styles.expenseDesc, { color: colors.text }]} numberOfLines={1}>
            {item.description}
          </Text>
          <View style={styles.expenseMeta}>
            <Badge variant="default" style={{ marginRight: 8 }}>
              {CATEGORIES[item.category] || "🤷"} {item.category}
            </Badge>
            <Text style={[styles.expenseDate, { color: colors.textMuted }]}>{fmt(item.date)}</Text>
          </View>
        </View>
        <Text style={[styles.expenseAmount, { color: colors.text }]}>₹{item.amount.toFixed(2)}</Text>
      </View>
      <View style={[styles.expenseActions, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => { setEditingExpense({ ...item }); setIsEditModalOpen(true); }}
          style={[styles.actionBtn, { borderColor: colors.border }]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Edit size={13} color={colors.textMuted} />
          <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDelete(item.id)}
          style={[styles.actionBtn, { borderColor: colors.border }]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Trash2 size={13} color={colors.destructive} />
          <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  // ------- Export step 1 presets -------
  const exportPresets: { id: ExportPreset; label: string }[] = [
    { id: "last7", label: "Last 7 days" },
    { id: "last30", label: "Last 30 days" },
    { id: "last90", label: "Last 90 days" },
    { id: "thisMonth", label: "This month" },
    { id: "custom", label: "Custom range" },
  ];

  const { from: exportFrom, to: exportTo } = getPresetRange(exportPreset, exportCustomFrom, exportCustomTo);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ---- Filters Bar ---- */}
      <View style={[styles.filtersBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}>
          <Search size={15} color={colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search..."
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <X size={13} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter chips row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContent}>
          {/* Category */}
          <TouchableOpacity
            onPress={() => setShowCategoryPicker(true)}
            style={[styles.chip, { backgroundColor: categoryFilter !== "all" ? colors.primaryBg : colors.input, borderColor: categoryFilter !== "all" ? colors.text : colors.inputBorder }]}
          >
            <Filter size={12} color={categoryFilter !== "all" ? colors.text : colors.textMuted} />
            <Text style={[styles.chipText, { color: categoryFilter !== "all" ? colors.text : colors.textMuted }]}>
              {categoryFilter === "all" ? "Category" : `${CATEGORIES[categoryFilter]} ${categoryFilter}`}
            </Text>
            <ChevronDown size={11} color={categoryFilter !== "all" ? colors.text : colors.textMuted} />
          </TouchableOpacity>

          {/* From date */}
          <TouchableOpacity
            onPress={() => setShowDatePicker("from")}
            style={[styles.chip, { backgroundColor: dateFrom ? colors.primaryBg : colors.input, borderColor: dateFrom ? colors.text : colors.inputBorder }]}
          >
            <Calendar size={12} color={dateFrom ? colors.text : colors.textMuted} />
            <Text style={[styles.chipText, { color: dateFrom ? colors.text : colors.textMuted }]}>
              {dateFrom ? format(dateFrom, "dd MMM") : "From"}
            </Text>
            {dateFrom ? (
              <TouchableOpacity onPress={() => setDateFrom(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <X size={11} color={colors.text} />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>

          {/* To date */}
          <TouchableOpacity
            onPress={() => setShowDatePicker("to")}
            style={[styles.chip, { backgroundColor: dateTo ? colors.primaryBg : colors.input, borderColor: dateTo ? colors.text : colors.inputBorder }]}
          >
            <Calendar size={12} color={dateTo ? colors.text : colors.textMuted} />
            <Text style={[styles.chipText, { color: dateTo ? colors.text : colors.textMuted }]}>
              {dateTo ? format(dateTo, "dd MMM") : "To"}
            </Text>
            {dateTo ? (
              <TouchableOpacity onPress={() => setDateTo(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <X size={11} color={colors.text} />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>

          {/* Clear */}
          {hasFilters && (
            <TouchableOpacity
              onPress={clearFilters}
              style={[styles.chip, { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)" }]}
            >
              <X size={12} color={colors.destructive} />
              <Text style={[styles.chipText, { color: colors.destructive }]}>Clear</Text>
            </TouchableOpacity>
          )}

          {/* Export */}
          <TouchableOpacity
            onPress={openExportModal}
            style={[styles.chip, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}
          >
            <Download size={12} color={colors.textMuted} />
            <Text style={[styles.chipText, { color: colors.textMuted }]}>Export</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryText, { color: colors.textMuted }]}>
            {filteredExpenses.length} transaction{filteredExpenses.length !== 1 ? "s" : ""}
            {hasFilters ? " (filtered)" : ""}
          </Text>
          {filteredExpenses.length > 0 && (
            <Text style={[styles.summaryAmount, { color: colors.text }]}>₹{totalFiltered.toFixed(2)}</Text>
          )}
        </View>
      </View>

      {/* ---- List ---- */}
      {isLoading && expenses.length === 0 ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {[...Array(6)].map((_, i) => <Skeleton key={i} height={90} borderRadius={12} />)}
        </ScrollView>
      ) : filteredExpenses.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.background }]}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {hasFilters ? "No matching transactions" : "No transactions yet"}
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
            {hasFilters ? "Try adjusting your filters." : "Start adding expenses from the Home tab."}
          </Text>
          {hasFilters && (
            <Button variant="outline" onPress={clearFilters} style={{ marginTop: 16 }}>Clear filters</Button>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredExpenses}
          keyExtractor={(item) => item.id}
          renderItem={renderExpenseItem}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ==== DATE PICKER (list filters) ==== */}
      {showDatePicker && (
        <DateTimePicker
          value={(showDatePicker === "from" ? dateFrom : dateTo) ?? new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={new Date()}
          onChange={(_, selected) => {
            if (showDatePicker === "from") setDateFrom(selected ?? null);
            else setDateTo(selected ?? null);
            setShowDatePicker(null);
          }}
        />
      )}

      {/* ==== CATEGORY PICKER MODAL ==== */}
      <Modal visible={showCategoryPicker} transparent animationType="slide" onRequestClose={() => setShowCategoryPicker(false)}>
        <TouchableOpacity style={styles.backdrop} onPress={() => setShowCategoryPicker(false)} activeOpacity={1} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Filter by Category</Text>
          {ALL_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => { setCategoryFilter(cat); setShowCategoryPicker(false); }}
              style={[styles.sheetItem, { borderBottomColor: colors.border }, categoryFilter === cat && { backgroundColor: colors.primaryBg }]}
            >
              <Text style={[styles.sheetItemText, { color: colors.text }]}>
                {cat === "all" ? "All Categories" : `${CATEGORIES[cat] || ""} ${cat}`}
              </Text>
              {categoryFilter === cat && <Check size={16} color={colors.text} />}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* ==== EDIT MODAL ==== */}
      <Modal visible={isEditModalOpen} transparent animationType="slide" onRequestClose={() => setIsEditModalOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={styles.backdrop} onPress={() => setIsEditModalOpen(false)} activeOpacity={1} />
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Edit Transaction</Text>
            {editingExpense && (
              <>
                <View style={styles.editField}>
                  <Text style={[styles.editLabel, { color: colors.textMuted }]}>Description</Text>
                  <TextInput
                    value={editingExpense.description}
                    onChangeText={(v) => setEditingExpense({ ...editingExpense, description: v })}
                    style={[styles.editInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.input }]}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.editField}>
                  <Text style={[styles.editLabel, { color: colors.textMuted }]}>Amount (₹)</Text>
                  <TextInput
                    value={String(editingExpense.amount)}
                    onChangeText={(v) => setEditingExpense({ ...editingExpense, amount: Number(v) || 0 })}
                    keyboardType="numeric"
                    style={[styles.editInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.input }]}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.editField}>
                  <Text style={[styles.editLabel, { color: colors.textMuted }]}>Category</Text>
                  <TextInput
                    value={editingExpense.category}
                    onChangeText={(v) => setEditingExpense({ ...editingExpense, category: v })}
                    style={[styles.editInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.input }]}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.modalActions}>
                  <Button variant="ghost" onPress={() => setIsEditModalOpen(false)} style={{ flex: 1 }}>Cancel</Button>
                  <Button onPress={handleEditSave} style={{ flex: 1 }}>Save</Button>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==== EXPORT MODAL ==== */}
      <Modal visible={isExportModalOpen} transparent animationType="slide" onRequestClose={() => setIsExportModalOpen(false)}>
        <TouchableOpacity style={styles.backdrop} onPress={() => setIsExportModalOpen(false)} activeOpacity={1} />
        <View style={[styles.exportSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>

          {/* Header */}
          <View style={styles.exportHeader}>
            <View>
              <Text style={[styles.sheetTitle, { color: colors.text, marginBottom: 2 }]}>Export Expenses</Text>
              <Text style={[styles.exportSubtitle, { color: colors.textMuted }]}>
                {exportStep === 1 ? "Step 1: Select date range" : "Step 2: Choose format"}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setIsExportModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Step indicator */}
          <View style={styles.stepRow}>
            {[1, 2].map((s) => (
              <View key={s} style={[styles.stepDot, { backgroundColor: exportStep >= s ? colors.text : colors.inputBorder }]} />
            ))}
          </View>

          {/* ---- Step 1: Date range ---- */}
          {exportStep === 1 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Presets</Text>
              <View style={styles.presetsGrid}>
                {exportPresets.map(({ id, label }) => (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setExportPreset(id)}
                    style={[
                      styles.presetBtn,
                      { borderColor: exportPreset === id ? colors.text : colors.inputBorder, backgroundColor: exportPreset === id ? colors.primaryBg : colors.input },
                    ]}
                  >
                    <Text style={[styles.presetBtnText, { color: exportPreset === id ? colors.text : colors.textMuted }]}>
                      {label}
                    </Text>
                    {exportPreset === id && <Check size={13} color={colors.text} />}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom date inputs */}
              {exportPreset === "custom" && (
                <View style={styles.customDateRow}>
                  <TouchableOpacity
                    onPress={() => setShowExportDatePicker("from")}
                    style={[styles.datePill, { borderColor: colors.inputBorder, backgroundColor: colors.input }]}
                  >
                    <Calendar size={13} color={colors.textMuted} />
                    <Text style={[styles.datePillText, { color: exportCustomFrom ? colors.text : colors.textSecondary }]}>
                      {exportCustomFrom ? format(exportCustomFrom, "dd MMM yyyy") : "From date"}
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ color: colors.textMuted }}>→</Text>
                  <TouchableOpacity
                    onPress={() => setShowExportDatePicker("to")}
                    style={[styles.datePill, { borderColor: colors.inputBorder, backgroundColor: colors.input }]}
                  >
                    <Calendar size={13} color={colors.textMuted} />
                    <Text style={[styles.datePillText, { color: exportCustomTo ? colors.text : colors.textSecondary }]}>
                      {exportCustomTo ? format(exportCustomTo, "dd MMM yyyy") : "To date"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Range preview */}
              <View style={[styles.rangePreview, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}>
                <Text style={[styles.rangePreviewText, { color: colors.textMuted }]}>
                  {format(exportFrom, "dd MMM yyyy")} → {format(exportTo, "dd MMM yyyy")}
                </Text>
                <Text style={[styles.rangeCount, { color: colors.text }]}>
                  {exportList.length} transaction{exportList.length !== 1 ? "s" : ""}
                </Text>
              </View>

              <View style={styles.modalActions}>
                <Button variant="outline" onPress={() => setIsExportModalOpen(false)} style={{ flex: 1 }}>Cancel</Button>
                <Button
                  onPress={() => setExportStep(2)}
                  disabled={exportPreset === "custom" && (!exportCustomFrom || !exportCustomTo)}
                  style={{ flex: 1 }}
                >
                  Next
                </Button>
              </View>
            </>
          )}

          {/* ---- Step 2: Format ---- */}
          {exportStep === 2 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Choose format</Text>
              <View style={styles.formatGrid}>
                {/* CSV card */}
                <TouchableOpacity
                  onPress={() => setExportFormat("csv")}
                  style={[
                    styles.formatCard,
                    {
                      borderColor: exportFormat === "csv" ? colors.text : colors.inputBorder,
                      backgroundColor: exportFormat === "csv" ? colors.primaryBg : colors.input,
                    },
                  ]}
                >
                  <View style={[styles.formatIconBox, { backgroundColor: exportFormat === "csv" ? "rgba(250,250,250,0.12)" : colors.card }]}>
                    <FileSpreadsheet size={28} color={exportFormat === "csv" ? colors.text : colors.textMuted} strokeWidth={1.6} />
                  </View>
                  <Text style={[styles.formatTitle, { color: exportFormat === "csv" ? colors.text : colors.textMuted }]}>CSV</Text>
                  <Text style={[styles.formatDesc, { color: colors.textMuted }]}>Spreadsheet{"\n"}(Excel, Sheets)</Text>
                  {exportFormat === "csv" && (
                    <View style={styles.formatCheck}><Check size={13} color={colors.text} /></View>
                  )}
                </TouchableOpacity>

                {/* PDF card */}
                <TouchableOpacity
                  onPress={() => setExportFormat("pdf")}
                  style={[
                    styles.formatCard,
                    {
                      borderColor: exportFormat === "pdf" ? colors.text : colors.inputBorder,
                      backgroundColor: exportFormat === "pdf" ? colors.primaryBg : colors.input,
                    },
                  ]}
                >
                  <View style={[styles.formatIconBox, { backgroundColor: exportFormat === "pdf" ? "rgba(250,250,250,0.12)" : colors.card }]}>
                    <FileText size={28} color={exportFormat === "pdf" ? colors.text : colors.textMuted} strokeWidth={1.6} />
                  </View>
                  <Text style={[styles.formatTitle, { color: exportFormat === "pdf" ? colors.text : colors.textMuted }]}>PDF</Text>
                  <Text style={[styles.formatDesc, { color: colors.textMuted }]}>Formatted{"\n"}document</Text>
                  {exportFormat === "pdf" && (
                    <View style={styles.formatCheck}><Check size={13} color={colors.text} /></View>
                  )}
                </TouchableOpacity>
              </View>

              {exportList.length > 0 && (
                <Text style={[styles.rangePreviewText, { color: colors.textMuted, textAlign: "center", marginBottom: 8 }]}>
                  {exportList.length} transaction{exportList.length !== 1 ? "s" : ""} · {format(exportFrom, "dd MMM")} – {format(exportTo, "dd MMM yyyy")}
                </Text>
              )}

              <View style={styles.modalActions}>
                <Button variant="outline" onPress={() => setExportStep(1)} style={{ flex: 1 }}>
                  Back
                </Button>
                <Button
                  onPress={handleExportDownload}
                  disabled={!exportFormat || exportList.length === 0 || exporting}
                  loading={exporting}
                  style={{ flex: 1 }}
                >
                  Download
                </Button>
              </View>
            </>
          )}
        </View>

        {/* Export date picker */}
        {showExportDatePicker && (
          <DateTimePicker
            value={(showExportDatePicker === "from" ? exportCustomFrom : exportCustomTo) ?? new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={new Date()}
            onChange={(_, selected) => {
              if (showExportDatePicker === "from") setExportCustomFrom(selected ?? null);
              else setExportCustomTo(selected ?? null);
              setShowExportDatePicker(null);
            }}
          />
        )}
      </Modal>

      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filtersBar: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  searchBox: {
    flexDirection: "row", alignItems: "center", borderRadius: 10,
    borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  chipsScroll: { flexGrow: 0 },
  chipsContent: { flexDirection: "row", gap: 7, paddingVertical: 2 },
  chip: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 20, borderWidth: 1, gap: 5,
  },
  chipText: { fontSize: 12, fontWeight: "500" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryText: { fontSize: 12 },
  summaryAmount: { fontSize: 13, fontWeight: "600" },

  // Expense card
  expenseCard: { padding: 14 },
  expenseHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  expenseInfo: { flex: 1 },
  expenseDesc: { fontSize: 15, fontWeight: "600", marginBottom: 6 },
  expenseMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  expenseDate: { fontSize: 12 },
  expenseAmount: { fontSize: 17, fontWeight: "700" },
  expenseActions: {
    flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: "500" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 22 },

  // Modal shared
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, borderWidth: 1, paddingBottom: 44,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  sheetItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 6,
  },
  sheetItemText: { fontSize: 15, textTransform: "capitalize" },
  editField: { marginBottom: 14 },
  editLabel: { fontSize: 13, fontWeight: "500", marginBottom: 6 },
  editInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },

  // Export modal
  exportSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, borderWidth: 1, paddingBottom: 44,
  },
  exportHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  exportSubtitle: { fontSize: 13 },
  stepRow: { flexDirection: "row", gap: 6, marginBottom: 20 },
  stepDot: { width: 20, height: 4, borderRadius: 2 },
  sectionLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },

  // Presets
  presetsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  presetBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
  },
  presetBtnText: { fontSize: 13, fontWeight: "500" },
  customDateRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 14 },
  datePill: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, borderWidth: 1,
  },
  datePillText: { fontSize: 13, flex: 1 },
  rangePreview: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 4,
  },
  rangePreviewText: { fontSize: 13 },
  rangeCount: { fontSize: 13, fontWeight: "600" },

  // Format cards
  formatGrid: { flexDirection: "row", gap: 12, marginBottom: 14 },
  formatCard: {
    flex: 1, alignItems: "center", padding: 18, borderRadius: 12,
    borderWidth: 1.5, gap: 10, position: "relative",
  },
  formatIconBox: { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  formatTitle: { fontSize: 16, fontWeight: "700" },
  formatDesc: { fontSize: 11, textAlign: "center", lineHeight: 16 },
  formatCheck: {
    position: "absolute", top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "rgba(250,250,250,0.15)",
    alignItems: "center", justifyContent: "center",
  },
});
