import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nContext, translate } from "@/lib/i18n";
import type { LibraryItem } from "@/domain/entities/library";
import Library from "@/pages/Library";
import Collections from "@/pages/Collections";
import Repertoire from "@/pages/Repertoire";
import BulkAddTasksPage from "@/pages/BulkAddTasksPage";
import { RoutineBuilder } from "@/components/diary/RoutineBuilder";
import { LinkTargetFields } from "@/components/diary/LinkTargetFields";

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), submit: vi.fn().mockResolvedValue(true), events: [] as object[], segments: [] as object[], collections: [] as object[] }));
const items: LibraryItem[] = [
  { id: 1, subjectId: 1, kind: "piece", title: "Alfa", composer: "Bach", createdAt: 3 },
  { id: 2, subjectId: 1, kind: "piece", title: "Beta", composer: "Mozart", techniqueIds: [9], isFavorite: true, createdAt: 2 },
  { id: 3, subjectId: 1, kind: "piece", title: "Gamma", composer: "Bach", inRepertoire: true, createdAt: 1 },
];
vi.mock("@/presentation/hooks/useEntities", () => ({
  useLibraryByKind: () => items,
  useLibrary: () => items,
  useHelpRequests: () => [], useTechniques: () => [{ id: 9, name: "Arpeggi" }], useSegments: () => mocks.segments, useAllSegments: () => [],
  useSubjects: () => [{ id: 1, name: "Piano", type: "instrument" }],
  useCollections: () => mocks.collections,
  useCollectionLinks: () => [{ collectionId: 1, itemId: 1 }, { collectionId: 1, itemId: 2 }, { collectionId: 1, itemId: 3 }, { collectionId: 2, itemId: 2 }],
  useRepertoire: () => items.filter(item => item.inRepertoire),
  usePerformanceEvents: () => mocks.events, usePerformanceLinks: () => [],
}));
vi.mock("@/presentation/hooks/usePresentationQuery", () => ({ usePresentationRead: (key: string) => key === "library.subject" ? items : [] }));
vi.mock("@/presentation/hooks/usePresentationControllers", () => ({ useSessionSubmission: () => ({ submitting: false, submit: mocks.submit }) }));
vi.mock("@/presentation/hooks/useReadiness", () => ({ useReadiness: () => ({ itemsById: new Map(), evidenceFor: () => ({ total: 0, toDo: [] }) }) }));
vi.mock("@/lib/services", () => ({ libraryService: { upsert: mocks.upsert }, collectionsService: {} }));
vi.mock("@/components/library/NewLibraryItemSheet", () => ({ NewLibraryItemSheet: () => null }));
vi.mock("@/components/collections/NewCollectionSheet", () => ({ NewCollectionSheet: () => null }));
vi.mock("@/components/library/ItemHelpSheet", () => ({ ItemHelpSheet: () => null }));
vi.mock("@/components/library/PerformanceEventSheet", () => ({ PerformanceEventSheet: () => null }));
vi.mock("@/components/library/BpmSparkline", () => ({ BpmSparkline: () => null }));
// Exercise the page's filtering and ordering without Radix's browser-only popup geometry.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children, disabled }: { value: string; onValueChange: (value: string) => void; children: ReactNode; disabled?: boolean }) => <select value={value} disabled={disabled} onChange={e => onValueChange(e.target.value)}>{children}</select>,
  SelectTrigger: () => null, SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{optionText(children)}</option>,
}));
function optionText(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child) ? optionText(child.props.children) : String(child)).join("");
}
const t = (key: string, vars?: Record<string, string | number>) => translate("it", key, vars);
function show(children: ReactNode) {
  return render(<MemoryRouter><I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}>{children}</I18nContext.Provider></MemoryRouter>);
}
function openFilters() { fireEvent.click(screen.getByRole("button", { name: /Filtri/ })); }
function openSorting() { fireEvent.click(screen.getByRole("button", { name: t("link.sortBy") })); }
function titles() { return screen.getAllByRole("listitem").map(row => within(row).getByRole("heading", { level: 3 }).textContent); }
beforeEach(() => vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); mocks.collections = []; mocks.segments = []; mocks.events = []; vi.clearAllMocks(); });

describe("library controls", () => {
  it("starts with repertoire before favorites, and lets either priority be disabled", () => {
    show(<Library />);
    expect(titles()).toEqual(["Gamma", "Beta", "Alfa"]);
    expect(screen.getByRole("button", { name: t("common.filters") })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("states.clearFilters") })).not.toBeInTheDocument();
    openSorting();
    expect(screen.getByRole("checkbox", { name: t("library.repertoireFirst") })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: t("library.favoritesFirst") })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: t("library.repertoireFirst") }));
    expect(titles()).toEqual(["Beta", "Alfa", "Gamma"]);
    fireEvent.click(screen.getByRole("checkbox", { name: t("library.favoritesFirst") }));
    const sort = screen.getByRole("option", { name: t("library.sortTitle") }).parentElement!;
    fireEvent.change(sort, { target: { value: "title" } });
    expect(titles()).toEqual(["Alfa", "Beta", "Gamma"]);
    fireEvent.change(sort, { target: { value: "titleDesc" } });
    expect(titles()).toEqual(["Gamma", "Beta", "Alfa"]);
    expect(screen.getByRole("button", { name: t("common.filters") })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Alfa" } });
    fireEvent.click(screen.getByRole("button", { name: t("states.clearFilters") }));
    expect(titles()).toEqual(["Gamma", "Beta", "Alfa"]);
    expect(sort).toHaveValue("titleDesc");
    expect(screen.getByRole("checkbox", { name: t("library.favoritesFirst") })).not.toBeChecked();
  });

  it("keeps repertoire ahead of favorites inside collection groups", () => {
    mocks.collections = [{ id: 1, name: "Raccolta", kind: "collection" }];
    show(<Library />);
    openSorting();
    fireEvent.click(screen.getByRole("button", { name: t("library.groupByCollection") }));
    expect(titles()).toEqual(["Gamma", "Beta", "Alfa"]);
  });

  it("counts only result filters and keeps sorting when filters are reset", () => {
    show(<Library />);
    openFilters();
    fireEvent.change(screen.getByRole("option", { name: "Bach" }).parentElement!, { target: { value: "Bach" } });
    expect(titles()).toEqual(["Gamma", "Alfa"]);
    expect(screen.getByRole("button", { name: "Filtri (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rimuovi.*Autore: Bach/ })).toBeInTheDocument();
    openSorting();
    fireEvent.change(screen.getByRole("option", { name: t("library.sortTitleDesc") }).parentElement!, { target: { value: "titleDesc" } });
    expect(screen.getByRole("button", { name: "Filtri (1)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("states.clearFilters") }));
    expect(screen.getByRole("button", { name: "Filtri" })).toBeInTheDocument();
    expect(titles()).toEqual(["Gamma", "Beta", "Alfa"]);
  });

  it("persists a favorite without changing repertoire membership", () => {
    show(<Library />);
    fireEvent.click(screen.getByRole("button", { name: `${t("library.addFavorite")}: Alfa` }));
    expect(mocks.upsert).toHaveBeenCalledWith({ ...items[0], isFavorite: true });
  });

  it("filters task materials by repertoire", () => {
    show(<LinkTargetFields subjectId={1} linkType="item" setLinkType={() => {}} itemId={undefined} setItemId={() => {}} segmentIds={[]} setSegmentIds={() => {}} collectionId={undefined} setCollectionId={() => {}} />);
    openFilters();
    fireEvent.change(screen.getByRole("option", { name: t("repertoire.title") }).parentElement!, { target: { value: "repertoire" } });
    expect(screen.queryByRole("option", { name: /^Alfa/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^Gamma/ })).toBeInTheDocument();
  });

  it("filters bulk task and series creation by repertoire", () => {
    show(<BulkAddTasksPage />);
    openFilters();
    expect(screen.getByText("Alfa")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: t("repertoire.title") }));
    expect(screen.queryByText("Alfa")).not.toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("filters routine materials by repertoire without offering whole collections", () => {
    mocks.collections = [{ id: 1, name: "Raccolta", kind: "collection" }];
    show(<RoutineBuilder onDone={() => {}} onCancel={() => {}} />);
    openFilters();
    fireEvent.change(screen.getByRole("option", { name: t("repertoire.title") }).parentElement!, { target: { value: "repertoire" } });
    expect(screen.queryByText("Alfa")).not.toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
    expect(screen.queryByText("Raccolta")).not.toBeInTheDocument();
  });

  it("opens a collection and saves its individual material and segment selections", async () => {
    mocks.collections = [{ id: 1, name: "Raccolta", kind: "collection" }];
    mocks.segments = [{ id: 11, itemId: 1, label: "Introduzione", position: 0 }];
    show(<RoutineBuilder onDone={() => {}} onCancel={() => {}} />);
    openFilters();
    fireEvent.change(screen.getByRole("option", { name: t("studyRoutine.collections") }).parentElement!, { target: { value: "collection" } });
    expect(screen.queryByText("Alfa")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Raccolta/ }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Introduzione" } });
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("filters.clearSearch") }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Alfa/ }));
    fireEvent.click(screen.getByRole("button", { name: /Alfa: / }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Introduzione" }));
    expect(screen.getByRole("checkbox", { name: /Raccolta/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: t("filters.backToCollections") }));
    fireEvent.click(screen.getByRole("button", { name: /Esplora Raccolta/ }));
    expect(screen.getByRole("checkbox", { name: /Alfa/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: /Alfa: / }));
    expect(screen.getByRole("checkbox", { name: "Introduzione" })).toBeChecked();
    fireEvent.click(screen.getByText(t("weekday.1").slice(0, 3), { selector: "label" }));
    fireEvent.submit(screen.getByRole("textbox", { name: t("studyRoutine.name") }).closest("form")!);
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ groups: [expect.objectContaining({ pool: [{ type: "item", id: 1 }, { type: "segment", id: 11 }] })] }));
  }, 10000);

  it("paginates routine fragments without losing selections", () => {
    mocks.segments = Array.from({ length: 6 }, (_, index) => ({ id: index + 20, itemId: 1, label: `Frammento ${index + 1}`, position: index }));
    show(<RoutineBuilder onDone={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Alfa: / }));
    expect(screen.getAllByRole("checkbox", { name: /^Frammento/ })).toHaveLength(5);
    expect(screen.queryByText("Frammento 6")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Frammento 6" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByRole("checkbox", { name: "Frammento 6" })).toBeChecked();
  });

  it("reorders routine groups with arrows and preserves each group's materials", () => {
    show(<RoutineBuilder initial={{ id: 1, subjectId: 1, name: "Tecnica", startDate: "2026-10-18", createdAt: 0,
      weeksAhead: 1, repetitionCap: 1, matrix: { "1": { scales: 2, arpeggios: 1 } },
      groups: [{ id: "scales", name: "Scale", pool: [{ type: "item", id: 1 }, { type: "item", id: 2 }] },
        { id: "arpeggios", name: "Arpeggi", pool: [{ type: "item", id: 3 }] }],
    }} onDone={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("button", { name: `${t("segments.moveUp")}: Scale` })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: `${t("segments.moveUp")}: Arpeggi` }));
    expect(screen.getByRole("button", { name: `${t("segments.moveDown")}: Scale` })).toBeDisabled();
    fireEvent.submit(screen.getByRole("textbox", { name: t("studyRoutine.name") }).closest("form")!);
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ groups: [
      expect.objectContaining({ id: "arpeggios", pool: [{ type: "item", id: 3 }] }),
      expect.objectContaining({ id: "scales", pool: [{ type: "item", id: 1 }, { type: "item", id: 2 }] }),
    ] }));
  });

  it("shows repertoire without review deadlines and lets the user start a task", () => {
    show(<Repertoire />);
    expect(screen.queryByText(/Ripasso/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("library.practiceThis") })).toHaveAttribute("href", "/tasks/new");
  });

  it("searches collections by author and resets without treating no matches as an empty library", () => {
    mocks.collections = [{ id: 1, name: "Sonate", composer: "Bach", kind: "collection" }, { id: 2, name: "Studi", composer: "Chopin", kind: "collection" }];
    show(<Collections />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "chopin" } });
    expect(screen.getByRole("link", { name: "Studi" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sonate" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nessuno" } });
    expect(screen.getByText(t("common.noResults"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("states.clearFilters") }));
    expect(screen.getByRole("link", { name: "Sonate" })).toBeInTheDocument();
  });

  it("keeps repertoire search visible and can clear a query with no matches", () => {
    show(<Repertoire />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Mozart" } });
    expect(screen.queryByRole("heading", { name: "Gamma" })).not.toBeInTheDocument();
    expect(screen.getByText(t("common.noResults"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("states.clearFilters") }));
    expect(screen.getByRole("heading", { name: "Gamma" })).toBeInTheDocument();
  });

  it("combines event venue search, period and kind", () => {
    mocks.events = [
      { id: 1, name: "Esame futuro", kind: "exam", date: "2099-01-01", venue: "Roma", createdAt: 1 },
      { id: 2, name: "Concerto passato", kind: "concert", date: "2000-01-01", venue: "Roma", createdAt: 1 },
      { id: 3, name: "Concerto futuro", kind: "concert", date: "2099-01-01", venue: "Milano", createdAt: 1 },
    ];
    show(<Repertoire />);
    fireEvent.click(screen.getByRole("tab", { name: t("performances.tab") }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Roma" } });
    openFilters();
    fireEvent.change(screen.getByRole("option", { name: t("filters.upcoming") }).parentElement!, { target: { value: "upcoming" } });
    expect(screen.getByRole("link", { name: "Esame futuro" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Concerto passato" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Concerto futuro" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("option", { name: t("performances.kind.concert") }).parentElement!, { target: { value: "concert" } });
    expect(screen.getByText(t("common.noResults"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("states.clearFilters") }));
    expect(screen.getByRole("link", { name: "Concerto passato" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Concerto futuro" })).toBeInTheDocument();
  });

  it("paginates collections, clamps after removal and resets when changing kind", () => {
    mocks.collections = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: `Raccolta ${i + 1}`, kind: "collection" }));
    const view = show(<Collections />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(within(screen.getByRole("list")).getByText("Raccolta 6")).toBeInTheDocument();
    mocks.collections = mocks.collections.slice(0, 5);
    view.rerender(<MemoryRouter><I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}><Collections /></I18nContext.Provider></MemoryRouter>);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: t("collections.kind.manual") }));
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: t("collections.kind.collection") }));
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });
});
