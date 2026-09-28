import { useState } from "react"

import { ChevronDownIcon, RotateCcwIcon, SlidersHorizontalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { type DocumentSettings, defaultSettings, isPixelRatio, MarkdownTheme, PixelRatio, settingRanges } from "./model"

export interface WorkspaceSettingsProps {
    data: DocumentSettings
    disabled: boolean
    onChange: (settings: DocumentSettings) => void
}

export function ThemePicker({ data, disabled, onChange }: WorkspaceSettingsProps) {
    return (
        <section className="theme-section" aria-labelledby="theme-label">
            <div className="section-caption">
                <h2 id="theme-label">图片主题</h2>
                <span>给文字一个合适的背景</span>
            </div>
            <RadioGroup
                className="theme-options"
                value={data.theme}
                disabled={disabled}
                onValueChange={value => {
                    if (Object.values(MarkdownTheme).includes(value as MarkdownTheme)) onChange({ ...data, theme: value as MarkdownTheme })
                }}
                aria-labelledby="theme-label"
            >
                {Object.entries(MarkdownTheme).map(([label, value]) => (
                    <label className="theme-option" key={value} data-selected={data.theme === value}>
                        <span className="theme-swatch" data-document-theme={value} aria-hidden="true">
                            <span>字</span>
                            <i />
                            <i />
                        </span>
                        <span className="theme-option-label">
                            <RadioGroupItem value={value} aria-label={label} />
                            <span>{label}</span>
                        </span>
                    </label>
                ))}
            </RadioGroup>
        </section>
    )
}

const numericFields = [
    { key: "width", label: "画布宽度", unit: "px" },
    { key: "fontSize", label: "正文字号", unit: "px" },
    { key: "lineHeight", label: "行高", unit: "倍" },
    { key: "padding", label: "内边距", unit: "px" },
] as const

interface NumberSettingProps {
    field: (typeof numericFields)[number]
    value: number
    disabled: boolean
    onChange: (value: number) => void
}

function NumberSetting({ field, value, disabled, onChange }: NumberSettingProps) {
    const [editing, setEditing] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const range = settingRanges[field.key]

    function commit() {
        if (editing === null) return
        const parsed = editing.trim() ? Number(editing) : NaN

        if (!Number.isFinite(parsed) || parsed < range.min || parsed > range.max) setError(`请输入 ${range.min}–${range.max}，已保留原值`)
        else {
            setError(null)
            onChange(parsed)
        }

        setEditing(null)
    }

    return (
        <Field data-disabled={disabled} data-invalid={!!error}>
            <FieldLabel htmlFor={`setting-${field.key}`}>
                {field.label}
                <span className="text-muted-foreground">{field.unit}</span>
            </FieldLabel>
            <Input
                id={`setting-${field.key}`}
                type="number"
                value={editing ?? value}
                {...range}
                disabled={disabled}
                aria-invalid={!!error}
                aria-describedby={error ? `setting-${field.key}-error` : undefined}
                onChange={event => {
                    setEditing(event.currentTarget.value)
                    setError(null)
                }}
                onBlur={commit}
                onKeyDown={event => {
                    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                        event.preventDefault()
                        commit()
                    }

                    if (event.key === "Escape") {
                        setEditing(null)
                        setError(null)
                    }
                }}
            />
            {error && <FieldDescription id={`setting-${field.key}-error`}>{error}</FieldDescription>}
        </Field>
    )
}

export function WorkspaceSettings({ data, disabled, onChange }: WorkspaceSettingsProps) {
    return (
        <Collapsible className="settings-panel">
            <div className="settings-summary">
                <CollapsibleTrigger render={<Button variant="ghost" />}>
                    <SlidersHorizontalIcon data-icon="inline-start" />
                    排版设置
                    <ChevronDownIcon data-icon="inline-end" />
                </CollapsibleTrigger>
                <span>
                    {data.width} px<span className="summary-dot">·</span>
                    {data.fontSize} px<span className="summary-dot">·</span>
                    {data.lineHeight} 倍行高
                </span>
                <div className="export-scale">
                    <span id="scale-label">清晰度</span>
                    <ToggleGroup
                        value={[String(data.pixelRatio)]}
                        disabled={disabled}
                        onValueChange={values => {
                            const value = Number(values[0])
                            if (isPixelRatio(value)) onChange({ ...data, pixelRatio: value })
                        }}
                        aria-labelledby="scale-label"
                        variant="outline"
                        spacing={0}
                        size="sm"
                    >
                        {Object.values(PixelRatio).map(value => (
                            <ToggleGroupItem key={value} value={String(value)}>
                                {value}×
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>
            </div>
            <CollapsibleContent>
                <FieldGroup className="settings-fields">
                    {numericFields.map(field => (
                        <NumberSetting
                            key={field.key}
                            field={field}
                            value={data[field.key]}
                            disabled={disabled}
                            onChange={value => onChange({ ...data, [field.key]: value })}
                        />
                    ))}
                    <Field className="line-break-setting" data-disabled={disabled}>
                        <FieldLabel htmlFor="preserve-line-breaks">保留单次换行</FieldLabel>
                        <div className="flex min-h-8 items-center gap-3">
                            <Switch
                                id="preserve-line-breaks"
                                checked={data.preserveLineBreaks}
                                disabled={disabled}
                                aria-describedby="preserve-line-breaks-description"
                                onCheckedChange={preserveLineBreaks => onChange({ ...data, preserveLineBreaks })}
                            />
                            <FieldDescription id="preserve-line-breaks-description">关闭后按标准 Markdown 分段</FieldDescription>
                        </div>
                    </Field>
                    <Button className="self-end" variant="ghost" disabled={disabled} onClick={() => onChange({ ...defaultSettings, theme: data.theme })}>
                        <RotateCcwIcon data-icon="inline-start" />
                        重置排版
                    </Button>
                </FieldGroup>
            </CollapsibleContent>
        </Collapsible>
    )
}
