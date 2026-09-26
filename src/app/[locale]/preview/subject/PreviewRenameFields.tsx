'use client'

import { useState } from 'react'
import { RenameMaterialFields, type RenameMaterialLabels } from '@/components/materials/RenameMaterialControl'
import { splitFilename } from '@/lib/material-name'

/**
 * The rename panel in its editing state, for the subject preview (#124). The
 * real control opens it on a click and saves through the API; here the field
 * is live (typing works, so the caret and the row direction can be tried) and
 * the buttons do nothing.
 */
export function PreviewRenameFields({ filename, labels }: { filename: string; labels: RenameMaterialLabels }) {
  const { stem, ext } = splitFilename(filename)
  const [value, setValue] = useState(stem)
  return (
    <RenameMaterialFields
      inputId={`preview-rename-${stem.length}`}
      value={value}
      ext={ext}
      busy={false}
      labels={labels}
      onChange={setValue}
      onSave={() => {}}
      onCancel={() => {}}
    />
  )
}
