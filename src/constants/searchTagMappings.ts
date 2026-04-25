export type PaperTagValue = 'journal' | 'proceedings' | 'thesis'
export type SubmitPaperTag = 'JOURNAL_ARTICLE' | 'PROCEEDINGS_ARTICLE' | 'DISSERTATION'
export type SourceTag = 'arXiv' | 'DBLP' | 'Google Scholar'

export interface PaperTagItem {
  label: string
  value: PaperTagValue
}

export const PAPER_TAG_POOL: PaperTagItem[] = [
  { label: '会议', value: 'proceedings' },
  { label: '期刊', value: 'journal' },
  { label: '学位论文', value: 'thesis' }
]

export const DEFAULT_VISIBLE_PAPER_TAGS: PaperTagItem[] = PAPER_TAG_POOL.filter(tag =>
  tag.value === 'proceedings' || tag.value === 'journal'
)

export const DEFAULT_SUBMIT_PAPER_TAGS: SubmitPaperTag[] = ['JOURNAL_ARTICLE', 'PROCEEDINGS_ARTICLE']

export const SOURCE_OPTIONS: Array<{ label: SourceTag; value: SourceTag }> = [
  { label: 'arXiv', value: 'arXiv' },
  { label: 'DBLP', value: 'DBLP' },
  { label: 'Google Scholar', value: 'Google Scholar' }
]

export const DEFAULT_SOURCE_TAGS: SourceTag[] = ['arXiv', 'DBLP', 'Google Scholar']

export const buildSubmitPaperTags = (paperTag: PaperTagValue | ''): SubmitPaperTag[] => {
  switch (paperTag) {
    case 'journal':
      return ['JOURNAL_ARTICLE']
    case 'proceedings':
      return ['PROCEEDINGS_ARTICLE']
    case 'thesis':
      return ['DISSERTATION']
    default:
      return [...DEFAULT_SUBMIT_PAPER_TAGS]
  }
}

export const buildSubmitSourceTags = (selectedSources: SourceTag[]): SourceTag[] => {
  if (selectedSources.length === 0) {
    return [...DEFAULT_SOURCE_TAGS]
  }

  return [...selectedSources]
}

export const normalizePaperTag = (paperTag: string | null): string | null => {
  if (!paperTag) {
    return null
  }

  const paperTagMap: Record<string, string> = {
    THESIS: 'DISSERTATION',
    DISSERTATION: 'DISSERTATION'
  }

  return paperTagMap[paperTag] || paperTag
}
