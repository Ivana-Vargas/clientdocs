"use client"

import Link from "next/link"
import { type PDFDocumentProxy, GlobalWorkerOptions, getDocument } from "pdfjs-dist"
import { useEffect, useMemo, useRef, useState } from "react"

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()

type ClientDocumentViewerLabels = {
  title: string
  subtitle: string
  backButton: string
  categoryLabel: string
  uploadedAtLabel: string
  previousPageButton: string
  nextPageButton: string
  fitWidthButton: string
  pageInputLabel: string
  loadingLabel: string
  loadErrorLabel: string
}

type ClientDocumentViewerProps = {
  clientPublicId: string
  documentPublicId: string
  documentName: string
  categoryName: string
  uploadedAt: string
  locale: "es" | "en"
  labels: ClientDocumentViewerLabels
}

function toReadableDate(dateIso: string, locale: "es" | "en") {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(dateIso))
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function touchDistance(
  first: { clientX: number; clientY: number },
  second: { clientX: number; clientY: number },
) {
  const dx = first.clientX - second.clientX
  const dy = first.clientY - second.clientY
  return Math.hypot(dx, dy)
}

export function ClientDocumentViewer({
  clientPublicId,
  documentPublicId,
  documentName,
  categoryName,
  uploadedAt,
  locale,
  labels,
}: ClientDocumentViewerProps) {
  const fileUrl = useMemo(
    () => `/api/clients/${clientPublicId}/documents/${documentPublicId}/file`,
    [clientPublicId, documentPublicId],
  )

  const containerRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef<Record<number, HTMLElement | null>>({})
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({})
  const renderRunRef = useRef(0)
  const renderTasksRef = useRef<Record<number, { cancel: () => void }>>({})
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null)
  const currentPageRef = useRef(1)
  const isProgrammaticScrollRef = useRef(false)

  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInput, setPageInput] = useState("1")
  const [totalPages, setTotalPages] = useState(0)
  const [zoomScale, setZoomScale] = useState(1)
  const [fitWidth, setFitWidth] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const [basePageWidth, setBasePageWidth] = useState(0)
  const [basePageHeight, setBasePageHeight] = useState(0)

  const autoScale = clamp(
    Math.min(
      (containerWidth || basePageWidth || 1) / (basePageWidth || 1),
      (containerHeight || basePageHeight || 1) / (basePageHeight || 1),
      1,
    ),
    0.35,
    1,
  )

  const currentViewScale = fitWidth ? autoScale : zoomScale

  function applyManualZoom(nextScale: number) {
    setFitWidth(false)
    setZoomScale(clamp(nextScale, 0.35, 2))
  }

  useEffect(() => {
    let isCancelled = false

    const loadingTask = getDocument({
      url: fileUrl,
      withCredentials: true,
    })

    loadingTask.promise
      .then(async (nextDocument) => {
        if (isCancelled) {
          return
        }

        const firstPage = await nextDocument.getPage(1)
        const firstPageViewport = firstPage.getViewport({ scale: 1 })

        setPdfDocument(nextDocument)
        setCurrentPage(1)
        currentPageRef.current = 1
        setPageInput("1")
        setTotalPages(nextDocument.numPages)
        setBasePageWidth(firstPageViewport.width)
        setBasePageHeight(firstPageViewport.height)

        const container = containerRef.current
        if (container) {
          container.scrollTo({ top: 0, behavior: "auto" })
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setLoadError(true)
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      isCancelled = true
      void loadingTask.destroy()
    }
  }, [fileUrl])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const observer = new ResizeObserver(() => {
      setContainerWidth(container.clientWidth - 24)
      setContainerHeight(container.clientHeight - 24)
    })

    observer.observe(container)
    setContainerWidth(container.clientWidth - 24)
    setContainerHeight(container.clientHeight - 24)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!pdfDocument || !basePageWidth || !basePageHeight) {
      return
    }

    const targetScale = fitWidth ? autoScale : zoomScale
    const runId = ++renderRunRef.current

    for (const task of Object.values(renderTasksRef.current)) {
      try {
        task.cancel()
      } catch {
        // no-op
      }
    }

    renderTasksRef.current = {}

    const renderAllPages = async () => {
      for (let pageIndex = 1; pageIndex <= pdfDocument.numPages; pageIndex += 1) {
        if (runId !== renderRunRef.current) {
          return
        }

        const canvas = canvasRefs.current[pageIndex]
        if (!canvas) {
          continue
        }

        const page = await pdfDocument.getPage(pageIndex)
        const viewport = page.getViewport({ scale: targetScale })
        const context = canvas.getContext("2d")

        if (!context) {
          continue
        }

        const outputScale = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        context.setTransform(outputScale, 0, 0, outputScale, 0, 0)
        context.clearRect(0, 0, viewport.width, viewport.height)

        const renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        })

        renderTasksRef.current[pageIndex] = renderTask

        try {
          await renderTask.promise
        } catch (error) {
          const errorName = (error as { name?: string })?.name
          if (errorName !== "RenderingCancelledException") {
            throw error
          }
        } finally {
          if (renderTasksRef.current[pageIndex] === renderTask) {
            delete renderTasksRef.current[pageIndex]
          }
        }
      }
    }

    void renderAllPages().catch(() => {
      // no-op: rendering is best-effort and cancellable
    })

    return () => {
      for (const task of Object.values(renderTasksRef.current)) {
        try {
          task.cancel()
        } catch {
          // no-op
        }
      }

      renderTasksRef.current = {}
    }
  }, [autoScale, basePageHeight, basePageWidth, fitWidth, pdfDocument, zoomScale])

  useEffect(() => {
    currentPageRef.current = currentPage
  }, [currentPage])

  useEffect(() => {
    const container = containerRef.current
    if (!container || totalPages === 0) {
      return
    }

    let frame = 0

    const updateCurrentPageFromScroll = () => {
      cancelAnimationFrame(frame)

      frame = requestAnimationFrame(() => {
        if (isProgrammaticScrollRef.current) {
          return
        }

        const currentTop = container.scrollTop
        let closestPage = 1
        let closestDistance = Number.POSITIVE_INFINITY

        for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
          const pageNode = pageRefs.current[pageIndex]
          if (!pageNode) {
            continue
          }

          const distanceToStart = Math.abs(pageNode.offsetTop - currentTop)
          if (distanceToStart < closestDistance) {
            closestDistance = distanceToStart
            closestPage = pageIndex
          }
        }

        if (closestPage !== currentPageRef.current) {
          currentPageRef.current = closestPage
          setCurrentPage(closestPage)
          setPageInput(String(closestPage))
        }
      })
    }

    container.addEventListener("scroll", updateCurrentPageFromScroll, { passive: true })
    updateCurrentPageFromScroll()

    return () => {
      container.removeEventListener("scroll", updateCurrentPageFromScroll)
      cancelAnimationFrame(frame)
    }
  }, [totalPages])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey || isLoading || loadError) {
        return
      }

      event.preventDefault()
      const factor = event.deltaY < 0 ? 1.08 : 0.92
      applyManualZoom(currentViewScale * factor)
    }

    container.addEventListener("wheel", handleWheel, { passive: false })

    return () => {
      container.removeEventListener("wheel", handleWheel)
    }
  }, [currentViewScale, isLoading, loadError])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) {
        pinchRef.current = null
        return
      }

      const scaleAtStart = fitWidth
        ? autoScale
        : zoomScale

      pinchRef.current = {
        distance: touchDistance(event.touches[0], event.touches[1]),
        scale: scaleAtStart,
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinchRef.current || isLoading || loadError) {
        return
      }

      event.preventDefault()
      const nextDistance = touchDistance(event.touches[0], event.touches[1])
      const ratio = nextDistance / pinchRef.current.distance
      applyManualZoom(pinchRef.current.scale * ratio)
    }

    const handleTouchEnd = () => {
      pinchRef.current = null
    }

    container.addEventListener("touchstart", handleTouchStart, { passive: true })
    container.addEventListener("touchmove", handleTouchMove, { passive: false })
    container.addEventListener("touchend", handleTouchEnd, { passive: true })
    container.addEventListener("touchcancel", handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener("touchstart", handleTouchStart)
      container.removeEventListener("touchmove", handleTouchMove)
      container.removeEventListener("touchend", handleTouchEnd)
      container.removeEventListener("touchcancel", handleTouchEnd)
    }
  }, [autoScale, fitWidth, isLoading, loadError, zoomScale])

  function scrollToPage(nextPage: number) {
    const clampedPage = clamp(nextPage, 1, totalPages || 1)
    const container = containerRef.current
    const target = pageRefs.current[clampedPage]

    if (!container || !target) {
      return
    }

    const targetTop = Math.max(target.offsetTop, 0)
    isProgrammaticScrollRef.current = true
    container.scrollTo({ top: targetTop, behavior: "auto" })
    requestAnimationFrame(() => {
      container.scrollTo({ top: targetTop, behavior: "auto" })
      setTimeout(() => {
        isProgrammaticScrollRef.current = false
      }, 120)
    })
    currentPageRef.current = clampedPage
    setCurrentPage(clampedPage)
    setPageInput(String(clampedPage))
  }

  function handlePageInputCommit() {
    const parsed = Number.parseInt(pageInput, 10)

    if (!Number.isFinite(parsed)) {
      setPageInput(String(currentPage))
      return
    }

    scrollToPage(parsed)
  }

  const zoomPercent = Math.round(currentViewScale * 100)

  return (
    <main className="private-page documents-viewer-page">
      <header className="private-page__header clients-list-page__header documents-viewer-page__header">
        <div>
          <h1>{labels.title}</h1>
          <p>{labels.subtitle}</p>
        </div>
        <Link href={`/clients/${clientPublicId}/documents`} className="clients-secondary-link">
          {labels.backButton}
        </Link>
      </header>

      <article className="documents-viewer-card">
        <div className="documents-viewer-card__meta">
          <h2>{documentName}</h2>
          <p>
            {labels.categoryLabel}: <strong>{categoryName}</strong>
          </p>
          <p>
            {labels.uploadedAtLabel}: {toReadableDate(uploadedAt, locale)}
          </p>
        </div>

        <div className="documents-viewer-toolbar" aria-label="pdf controls">
          <div className="documents-viewer-toolbar__group">
            <button
              type="button"
              className="clients-secondary-button"
              onClick={() => scrollToPage(currentPage - 1)}
              disabled={isLoading || loadError || currentPage <= 1}
            >
              {labels.previousPageButton}
            </button>
            <label className="documents-viewer-toolbar__page-input-wrap">
              <span>{labels.pageInputLabel}</span>
              <input
                type="number"
                min={1}
                max={Math.max(totalPages, 1)}
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                onBlur={handlePageInputCommit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    handlePageInputCommit()
                  }
                }}
                disabled={isLoading || loadError}
              />
            </label>
            <span className="documents-viewer-toolbar__status">
              {currentPage} / {totalPages || 1}
            </span>
            <button
              type="button"
              className="clients-secondary-button"
              onClick={() => scrollToPage(currentPage + 1)}
              disabled={isLoading || loadError || currentPage >= totalPages}
            >
              {labels.nextPageButton}
            </button>
          </div>

          <div className="documents-viewer-toolbar__group documents-viewer-toolbar__group--zoom">
            <span className="documents-viewer-toolbar__status">{zoomPercent}%</span>
            <button
              type="button"
              className={fitWidth ? "clients-primary-button" : "clients-secondary-button"}
              onClick={() => setFitWidth(true)}
              disabled={isLoading || loadError}
            >
              {labels.fitWidthButton}
            </button>
          </div>
        </div>

        <div
          className="documents-viewer-card__frame-wrap"
          ref={containerRef}
        >
          {isLoading ? <p className="documents-viewer-card__state">{labels.loadingLabel}</p> : null}
          {loadError ? <p className="documents-viewer-card__state">{labels.loadErrorLabel}</p> : null}
          {!isLoading && !loadError
            ? (
                <div className="documents-viewer-card__pages">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageIndex) => (
                    <section
                      key={pageIndex}
                      className="documents-viewer-page-canvas"
                      data-page={pageIndex}
                      ref={(element) => {
                        pageRefs.current[pageIndex] = element
                      }}
                    >
                      <canvas
                        ref={(element) => {
                          canvasRefs.current[pageIndex] = element
                        }}
                        className="documents-viewer-card__canvas"
                      />
                    </section>
                  ))}
                </div>
              )
            : null}
        </div>
      </article>
    </main>
  )
}
