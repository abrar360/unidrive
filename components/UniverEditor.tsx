'use client';

import { useEffect, useRef, useState } from 'react';
import { useToast } from '../components/ToastProvider';

// Page setup for new documents, matching what Univer 0.10.6 created (and what
// all documents made before the upgrade store). Univer 1.x would otherwise
// create new documents in its pageless "modern" layout: 960px wide, 1.5 line
// spacing and 12px between paragraphs, with no page outline or margin marks.
const NEW_DOCUMENT_PAGE_SIZE = { width: 793.3333333333334, height: 1122.6666666666667 }; // A4 at 96 DPI
const NEW_DOCUMENT_MARGIN = 50;
const NEW_DOCUMENT_PARAGRAPH_STYLE = { spaceAbove: { v: 5 }, lineSpacing: 1, spaceBelow: { v: 0 } };

// Look up a service on the document's render unit. Univer registers most of
// these in its "rendered" lifecycle stage, which can come after the render unit
// (and its page-background layer) already exist, and asking too early throws.
// Treat that as "not ready yet" so the caller retries.
function getRenderService(render: any, ServiceClass: any): any | null {
  try {
    return render?.with?.(ServiceClass) ?? null;
  } catch {
    return null;
  }
}

// Univer 1.x paints page-layout documents on a grey workspace ("gray.100",
// drawn onto the canvas by its page-background layer), where 0.10.6 was white,
// and draws the page outline lighter and the L-shaped margin marks darker and
// bluer than 0.10.6 did. There's no setting for these, and Univer resets the
// layer's colours on every re-layout (i.e. on each edit), so wrap the layer's
// setFillColors: whenever Univer leaves a colour unset, use the 0.10.6 look.
// The page fill itself is left at Univer's default (white).
function applyWorkspaceColours(render: any): boolean {
  const background = render?.components?.get?.('__Document_Render_Background__');
  if (!background) return false; // not created yet
  if (typeof background.setFillColors !== 'function') {
    console.warn('Editor colours not applied: unexpected Univer internals');
    return true;
  }
  if (!background.__unidriveWhiteWorkspace) {
    const setFillColors = background.setFillColors.bind(background);
    background.setFillColors = (
      workspaceFill?: string,
      pageFill?: string,
      pageStroke?: string,
      marginStroke?: string
    ) => setFillColors(
      workspaceFill ?? EDITOR_WORKSPACE_COLOR,
      pageFill,
      pageStroke ?? EDITOR_PAGE_OUTLINE_COLOR,
      marginStroke ?? EDITOR_MARGIN_MARK_COLOR
    );
    background.__unidriveWhiteWorkspace = true;
  }
  background.setFillColors(undefined, undefined, undefined, undefined);
  return true;
}

// Univer 1.x adds Notion-style "block" menus that 0.10.6 didn't have:
//  - a "T ⠿" handle (or "+" on empty lines) next to whichever paragraph the
//    mouse is over, with a drag grip and a menu;
//  - a "/" command menu that opens whenever "/" is typed, swallowing the slash.
// There are no settings for either. Both come from DocParagraphMenuService:
// the "/" menu is gated by two checks (keydown and text input), and both
// menus are displayed through showParagraphMenu. Make the checks always fail
// (so "/" is typed as a normal character) and make showParagraphMenu a no-op.
// The table handle (shown when hovering a table) is not affected.
function disableBlockMenus(render: any, DocParagraphMenuService: any): boolean {
  const service = getRenderService(render, DocParagraphMenuService);
  if (!service) return false; // not registered yet
  if (service.__unidriveBlockMenusDisabled) return true;
  const expected = ['showParagraphMenu', '_shouldOpenSlashMenu', '_shouldOpenSlashMenuFromInput'];
  if (!expected.every((name) => typeof service[name] === 'function')) {
    // Univer internals changed; leave the menus alone rather than risk breaking input
    console.warn('Block menus not disabled: unexpected Univer internals');
    return true;
  }
  service._shouldOpenSlashMenu = () => false;
  service._shouldOpenSlashMenuFromInput = () => false;
  service.showParagraphMenu = () => {};
  service.hideParagraphMenu?.(true);
  service.__unidriveBlockMenusDisabled = true;
  return true;
}

// Univer shows a floating formatting toolbar above any text selection, and
// 1.x adds a "paste options" popup (Keep source / Match destination / Text
// only) after every paste. Neither has a setting.
//  - The selection toolbar is shown by DocFloatMenuService._showFloatMenu
//    whenever the selection becomes a non-empty range: make it a no-op.
//    All of its formatting buttons are also in the main toolbar.
//  - Every step of the paste-options flow checks
//    IDocClipboardService.isPasteOptionsEnabled: make it return false.
//    (This also turns off 1.x's Cmd/Ctrl+Shift+V "paste as plain text",
//    which goes through the same flow; normal paste is unaffected.)
// As with the other tweaks, unexpected internals mean nothing is patched.
function disableSelectionToolbar(render: any, DocFloatMenuService: any): boolean {
  const service = getRenderService(render, DocFloatMenuService);
  if (!service) return false; // not registered yet
  if (service.__unidriveSelectionToolbarDisabled) return true;
  if (typeof service._showFloatMenu !== 'function') {
    console.warn('Selection toolbar not disabled: unexpected Univer internals');
    return true;
  }
  service._showFloatMenu = () => {};
  service.hideFloatMenu?.();
  service.__unidriveSelectionToolbarDisabled = true;
  return true;
}

function disablePasteOptions(clipboardService: any): boolean {
  if (!clipboardService) return false; // not available yet
  if (clipboardService.__unidrivePasteOptionsDisabled) return true;
  if (typeof clipboardService.isPasteOptionsEnabled !== 'function') {
    console.warn('Paste options popup not disabled: unexpected Univer internals');
    return true;
  }
  clipboardService.isPasteOptionsEnabled = () => false;
  clipboardService.dismissPasteOptions?.();
  clipboardService.__unidrivePasteOptionsDisabled = true;
  return true;
}

// Build an empty document in the old A4 page layout, starting from Univer's own
// empty snapshot (so all required fields are present) with the page layout
// ("traditional" flavor) and 0.10.6's page size, margins and paragraph spacing.
function createBlankDocument(getDocsEmptySnapshot: any, traditionalFlavor: number) {
  const blank = getDocsEmptySnapshot(undefined, 'enUS', '', traditionalFlavor);
  blank.documentStyle = {
    ...blank.documentStyle,
    pageSize: { ...NEW_DOCUMENT_PAGE_SIZE },
    marginTop: NEW_DOCUMENT_MARGIN,
    marginBottom: NEW_DOCUMENT_MARGIN,
    marginLeft: NEW_DOCUMENT_MARGIN,
    marginRight: NEW_DOCUMENT_MARGIN,
  };
  blank.body.paragraphs = blank.body.paragraphs.map((paragraph: any) => ({
    ...paragraph,
    paragraphStyle: { ...NEW_DOCUMENT_PARAGRAPH_STYLE },
  }));
  return blank;
}

// Editor colours matched to how Univer 0.10.6 looked on screen. Measured from
// before/after screenshots: 0.10.6 rendered the L-marks at ~rgb(198-208) grey
// and the page outline at ~rgb(210-219); 1.x renders its defaults crisply
// (marks #A8B0BD, darker and bluish; outline #E3E5EA, lighter). Applied
// through the page-background layer; see applyWorkspaceColours.
const EDITOR_WORKSPACE_COLOR = '#ffffff'; // area around the page (1.x: grey)
const EDITOR_PAGE_OUTLINE_COLOR = '#d6d6d6'; // page border
const EDITOR_MARGIN_MARK_COLOR = '#c4c4c4'; // L-shaped margin marks


interface UniverEditorProps {
  documentId?: string;
  initialData?: any;
  title?: string;
  onSave?: (data: any) => void;
}

export default function UniverEditor({
  documentId,
  initialData,
  title = 'Untitled Document',
  onSave
}: UniverEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<any>(null);
  const [documentTitle, setDocumentTitle] = useState(initialData?.title || title);
  // Latest title for timer callbacks, which would otherwise see a stale state value
  const titleRef = useRef<string>(initialData?.title || title);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'changed' | 'saving'>('idle');
  const facadeRef = useRef<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const commandListenerRef = useRef<{ dispose: () => void } | null>(null);
  // What has changed since the last save was queued
  const contentDirtyRef = useRef(false);
  const titleDirtyRef = useRef(false);
  // Saves run one at a time through this chain, so two saves can never race
  // (on the create page, racing saves used to create the document twice).
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const savesInFlightRef = useRef(0);
  // Latest onSave, so callbacks registered once at init never call a stale one
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const { showToast } = useToast();

  const hasUnsavedChanges = () =>
    contentDirtyRef.current || titleDirtyRef.current || savesInFlightRef.current > 0;

  // Read the current document snapshot from Univer, synchronously.
  // Returns null when no real snapshot is available. Callers must not save in
  // that case: saving placeholder content would overwrite the user's document.
  const readSnapshot = (): any | null => {
    const univerAPI = facadeRef.current;
    if (!univerAPI) return null;

    try {
      // Univer 1.x: FDocument.save() replaces the old getSnapshot()
      const activeDoc = univerAPI.getActiveDocument?.();
      const snapshot = activeDoc?.save?.();
      return snapshot && snapshot.body ? snapshot : null;
    } catch (error) {
      console.error('Error extracting content:', error);
      return null;
    }
  };

  // Capture what needs saving *now* (synchronously, while the editor still
  // exists) and queue the network request behind any save already in flight.
  // Returns null if there was nothing to save.
  const queueSave = (opts: { forceContent?: boolean } = {}): Promise<void> | null => {
    const save = onSaveRef.current;
    if (!save) return null;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const wantContent = contentDirtyRef.current || !!opts.forceContent;
    const wantTitle = titleDirtyRef.current;
    if (!wantContent && !wantTitle) return null;

    const content = wantContent ? readSnapshot() : null;
    if (wantContent && !content && !wantTitle) {
      // Editor can't produce a snapshot; never save placeholder content
      if (opts.forceContent) {
        return Promise.reject(new Error('Could not read document content from the editor'));
      }
      return null;
    }

    // Without content the server keeps the existing content
    const payload: { title: string; content?: any } = content
      ? { title: titleRef.current, content }
      : { title: titleRef.current };

    // Edits made while this save is in flight mark the flags again
    contentDirtyRef.current = false;
    titleDirtyRef.current = false;
    savesInFlightRef.current += 1;
    setAutoSaveStatus('saving');

    const run = saveChainRef.current.then(async () => {
      try {
        await save(payload);
        setLastSaved(new Date());
      } catch (error) {
        // Keep the change marked as unsaved so it's retried and the
        // leave-page warning still fires
        if (content) contentDirtyRef.current = true;
        if (wantTitle) titleDirtyRef.current = true;
        throw error;
      } finally {
        savesInFlightRef.current -= 1;
        if (savesInFlightRef.current === 0) {
          setAutoSaveStatus(contentDirtyRef.current || titleDirtyRef.current ? 'changed' : 'idle');
        }
      }
    });
    // Keep the chain alive even if this save fails
    saveChainRef.current = run.catch(() => {});
    return run;
  };

  // Restart the 2 second debounce. Called on every keystroke, so it stays cheap:
  // the document is only read when the timer fires.
  const scheduleSave = () => {
    if (!onSaveRef.current) return;
    setAutoSaveStatus('changed');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      queueSave()?.catch((error) => console.error('Auto-save failed:', error));
    }, 2000);
  };

  // Called on every document mutation (each keystroke)
  const handleDocumentChange = () => {
    contentDirtyRef.current = true;
    scheduleSave();
  };

  const handleTitleChange = (newTitle: string) => {
    titleRef.current = newTitle;
    titleDirtyRef.current = true;
    scheduleSave();
  };

  // Function to set up auto-save functionality.
  // Univer 1.x exposes command events via univerAPI.addEvent(Event.CommandExecuted).
  // Only document mutations (actual content changes) trigger a change check;
  // selection/cursor operations are ignored.
  const setupAutoSave = () => {
    const univerAPI = facadeRef.current;
    if (!univerAPI || !onSave) {
      console.warn("Cannot set up auto-save: facade or onSave not available");
      return;
    }

    try {
      commandListenerRef.current?.dispose();
      commandListenerRef.current = univerAPI.addEvent(
        univerAPI.Event.CommandExecuted,
        (event: { id?: string }) => {
          if (event.id && event.id.startsWith("doc.mutation")) {
            handleDocumentChange();
          }
        }
      );
    } catch (error) {
      console.error("Error setting up auto-save listener:", error);
      console.warn("Auto-save disabled due to event listener setup failure");
    }
  };

  // Neutralise the app's dark <body> styles while the editor is mounted so they
  // can't leak into copied text (see body.unidrive-editor-open in globals.css).
  useEffect(() => {
    document.body.classList.add('unidrive-editor-open');
    return () => {
      document.body.classList.remove('unidrive-editor-open');
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // React Strict Mode (dev) mounts, unmounts and re-mounts every component.
    // Initialisation is async, so without this flag the first run would still
    // finish after its cleanup and leave a second, orphaned editor running.
    let cancelled = false;
    let instance: any = null;

    const initializeUniver = async () => {
      try {
        // Load everything first; nothing is created until all awaits are done.
        const [
          { LocaleType, mergeLocales, Univer, UniverInstanceType, DocumentFlavor, getDocsEmptySnapshot },
          DesignEnUS,
          { UniverDocsPlugin },
          { UniverDocsUIPlugin, DocParagraphMenuService, DocFloatMenuService, IDocClipboardService },
          DocsUIEnUS,
          { UniverFormulaEnginePlugin },
          { UniverRenderEnginePlugin, IRenderManagerService },
          { UniverUIPlugin },
          UIEnUS,
          { FUniver },
        ] = await Promise.all([
          import('@univerjs/core'),
          import('@univerjs/design/locale/en-US'),
          import('@univerjs/docs'),
          import('@univerjs/docs-ui'),
          import('@univerjs/docs-ui/locale/en-US'),
          import('@univerjs/engine-formula'),
          import('@univerjs/engine-render'),
          import('@univerjs/ui'),
          import('@univerjs/ui/locale/en-US'),
          import('@univerjs/core/lib/facade'),
        ]);

        // Facade extensions (they patch FUniver when imported)
        await Promise.all([
          import('@univerjs/engine-formula/lib/facade'),
          import('@univerjs/ui/lib/facade'),
          // Univer 1.x: getActiveDocument()/FDocument live in the docs facade
          import('@univerjs/docs/lib/facade'),
          import('@univerjs/docs-ui/lib/facade'),
        ]);

        // This run was cleaned up while loading (Strict Mode or fast navigation)
        if (cancelled || !containerRef.current) return;

        const univer = new Univer({
          locale: LocaleType.EN_US,
          locales: {
            [LocaleType.EN_US]: mergeLocales(
              DesignEnUS.default,
              UIEnUS.default,
              DocsUIEnUS.default,
            ),
          },
        });
        instance = univer;
        univerRef.current = univer;
        facadeRef.current = FUniver.newAPI(univer);

        univer.registerPlugin(UniverRenderEnginePlugin);
        univer.registerPlugin(UniverFormulaEnginePlugin);
        univer.registerPlugin(UniverUIPlugin, {
          container: containerRef.current,
          // Univer 1.x defaults to a tabbed ribbon ("classic": Start / Insert /
          // View). "simple" puts all tools in one row, like 0.10.6 did.
          ribbonType: 'simple',
        });
        univer.registerPlugin(UniverDocsPlugin);
        univer.registerPlugin(UniverDocsUIPlugin);

        // Create the document with existing content or empty
        const documentData = initialData?.content ? {
          id: documentId || 'default-doc',
          ...initialData.content
        } : createBlankDocument(getDocsEmptySnapshot, DocumentFlavor.TRADITIONAL);

        const docUnit = univer.createUnit(UniverInstanceType.UNIVER_DOC, documentData);

        // Apply the editor tweaks above (colours, block menus, selection
        // toolbar, paste popup). The render unit and its services are created
        // asynchronously and at different lifecycle stages, so retry each one
        // independently until it has been applied (for up to ~15 seconds),
        // instead of giving up on the first failure. Uses a timer rather than
        // animation frames, which browsers pause while a tab is hidden.
        const unitId = docUnit?.getUnitId?.();
        const pending: Record<string, boolean> = {
          colours: true,
          blockMenus: true,
          selectionToolbar: true,
          pasteOptions: true,
        };
        let attempts = 0;
        const applyEditorTweaks = () => {
          if (cancelled || !unitId) return;
          let render: any = null;
          let clipboardService: any = null;
          try {
            const injector = univer.__getInjector();
            render = injector.get(IRenderManagerService).getRenderUnitById(unitId);
            clipboardService = injector.get(IDocClipboardService);
          } catch {
            // Services not available yet; retried below
          }
          if (render) {
            if (pending.colours) pending.colours = !applyWorkspaceColours(render);
            if (pending.blockMenus) pending.blockMenus = !disableBlockMenus(render, DocParagraphMenuService);
            if (pending.selectionToolbar) pending.selectionToolbar = !disableSelectionToolbar(render, DocFloatMenuService);
          }
          if (pending.pasteOptions) pending.pasteOptions = !disablePasteOptions(clipboardService);

          const remaining = Object.keys(pending).filter((key) => pending[key]);
          if (remaining.length === 0) return;
          if (++attempts < 300) {
            setTimeout(applyEditorTweaks, 50);
          } else {
            console.warn('Editor tweaks not applied:', remaining.join(', '));
          }
        };
        setTimeout(applyEditorTweaks, 0);

        // Set up auto-save once the document exists
        if (onSave) {
          setupAutoSave();
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Univer initialization failed:', error);
        showToast('Document editor failed to initialize', 'error');
      }
    };

    initializeUniver();

    return () => {
      cancelled = true;
      // Save anything still waiting on the debounce timer. The snapshot is read
      // synchronously here, while the editor still exists; the request finishes
      // in the background (the page is still loaded for in-app navigation).
      queueSave()?.catch((error) => console.error('Save on close failed:', error));
      commandListenerRef.current?.dispose();
      commandListenerRef.current = null;
      if (instance) {
        const toDispose = instance;
        if (univerRef.current === toDispose) {
          univerRef.current = null;
          facadeRef.current = null;
        }
        instance = null;
        // Univer unmounts its own React root on dispose; doing that synchronously
        // inside this React cleanup triggers "synchronously unmount a root while
        // React was already rendering". Defer it to the next task.
        setTimeout(() => toDispose.dispose(), 0);
      }
    };
  }, []); // Initialise once per mount; initialData is only read at creation

  // Closing/reloading the tab or a full-page navigation: start saving whatever
  // is pending and ask the browser to show its "Leave site?" prompt, because a
  // request started during unload can be cancelled before it completes.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      queueSave()?.catch((error) => console.error('Save on unload failed:', error));
      if (hasUnsavedChanges()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const handleSave = async () => {
    if (!onSave || saving) return;

    setSaving(true);
    try {
      // Always send the current content, even if nothing is marked as changed
      await queueSave({ forceContent: true });
    } catch (error) {
      // The page's onSave already shows a toast for request failures; only
      // report the case where the editor itself couldn't produce content.
      console.error('Save failed:', error);
      if (error instanceof Error && error.message.startsWith('Could not read document content')) {
        showToast('Failed to save document', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header with save button */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center space-x-4">
          <input
            type="text"
            value={documentTitle}
            onChange={(e) => {
              setDocumentTitle(e.target.value);
              handleTitleChange(e.target.value);
            }}
            className="text-lg font-medium text-gray-900 bg-transparent border-none outline-none focus:bg-gray-50 px-2 py-1 rounded"
            placeholder="Untitled Document"
          />
          <div className="flex items-center space-x-2">
            {lastSaved && (
              <span className="text-sm text-gray-500">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            {autoSaveStatus === 'changed' && (
              <span className="text-sm text-yellow-600">• Editing...</span>
            )}
            {autoSaveStatus === 'saving' && (
              <span className="text-sm text-blue-600">Saving...</span>
            )}
          </div>
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Univer Editor Container (see .unidrive-univer in styles/univer.css) */}
      <div
        ref={containerRef}
        className="unidrive-univer"
        style={{
          width: '100%',
          height: '100%',
          flex: 1
        }}
      />
    </div>
  );
}