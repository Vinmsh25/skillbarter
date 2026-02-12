import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import Editor, { OnMount, OnChange } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import throttle from 'lodash.throttle'
import clsx from 'clsx'

interface FileEntry {
    name: string
    language: string
    content: string
}

interface CodeEditorProps {
    sessionId: string
    isVisible: boolean
    onCodeChange?: (data: any) => void
}

const LANGUAGE_TEMPLATES: Record<string, string> = {
    javascript: '// JavaScript\nconsole.log("Hello World");',
    python: '# Python\nprint("Hello World")',
    java: '// Java\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello World");\n    }\n}',
    cpp: '// C++\n#include <iostream>\n\nint main() {\n    std::cout << "Hello World" << std::endl;\n    return 0;\n}',
    c: '// C\n#include <stdio.h>\n\nint main() {\n    printf("Hello World\\n");\n    return 0;\n}',
    css: '/* CSS */\nbody { background: #000; }',
    markdown: '# Markdown\nCollaborate here!',
}

const LANGUAGE_MAP: Record<string, string> = {
    'js': 'javascript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'h': 'cpp',
    'css': 'css',
    'md': 'markdown',
}

export default function CodeEditor({ sessionId, isVisible, onCodeChange }: CodeEditorProps) {
    const [files, setFiles] = useState<FileEntry[]>([
        { name: 'main.py', language: 'python', content: LANGUAGE_TEMPLATES.python },
        { name: 'solution.cpp', language: 'cpp', content: LANGUAGE_TEMPLATES.cpp },
        { name: 'Main.java', language: 'java', content: LANGUAGE_TEMPLATES.java },
    ])
    const [activeFileIndex, setActiveFileIndex] = useState(0)
    const activeFile = files[activeFileIndex] || files[0]

    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
    const isImportingRef = useRef(false)
    const [isCreatingFile, setIsCreatingFile] = useState(false)
    const [newFileName, setNewFileName] = useState('')

    // Load persisted session state
    useEffect(() => {
        const saved = localStorage.getItem(`ide_state_${sessionId}`)
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                if (parsed.files && parsed.files.length > 0) {
                    // Aggressive fix for corrupted state
                    const fixedFiles = parsed.files.map((f: FileEntry) => {
                        // 1. Rename App.java to Main.java
                        if (f.name === 'App.java') {
                            f.name = 'Main.java';
                        }

                        // 2. Validate content matches extension
                        if (f.name.endsWith('.java') && (f.content.includes('#include') || f.content.includes('import React'))) {
                            return { ...f, content: LANGUAGE_TEMPLATES.java }
                        }
                        if (f.name.endsWith('.py') && (f.content.includes('public class') || f.content.includes('#include'))) {
                            return { ...f, content: LANGUAGE_TEMPLATES.python }
                        }
                        if (f.name.endsWith('.cpp') && (f.content.includes('public class') || f.content.includes('def '))) {
                            return { ...f, content: LANGUAGE_TEMPLATES.cpp }
                        }

                        // 3. Ensure Main.java has the correct class name if it was renamed/reset
                        if (f.name === 'Main.java' && !f.content.includes('public class Main')) {
                            return { ...f, content: LANGUAGE_TEMPLATES.java }
                        }

                        return f
                    })
                    setFiles(fixedFiles)
                }
                if (parsed.activeIndex !== undefined) setActiveFileIndex(parsed.activeIndex)
            } catch (e) {
                console.error('Failed to parse saved IDE state', e)
            }
        }
    }, [sessionId])

    // Create a stable debounced save function
    const debouncedSave = useMemo(
        () => throttle((files: FileEntry[], activeIndex: number) => {
            localStorage.setItem(`ide_state_${sessionId}`, JSON.stringify({ files, activeIndex }))
        }, 1000),
        [sessionId]
    )

    // Throttled broadcast
    const broadcastChange = useMemo(() =>
        throttle((updatedFiles: FileEntry[], activeIndex: number) => {
            if (isImportingRef.current) return

            onCodeChange?.({
                files: updatedFiles,
                activeIndex,
                source: 'local'
            })
        }, 500),
        [onCodeChange])

    // Update state immediately, debounce storage/broadcast
    const updateState = (newFiles: FileEntry[], newIndex: number) => {
        // Essential: Update editor content if switching files
        if (newIndex !== activeFileIndex && editorRef.current) {
            editorRef.current.setValue(newFiles[newIndex].content)
        }

        setFiles(newFiles)
        setActiveFileIndex(newIndex)
        debouncedSave(newFiles, newIndex)
        broadcastChange(newFiles, newIndex)
    }

    // Handle incoming updates
    useEffect(() => {
        const handleCodeUpdate = (event: CustomEvent) => {
            const { data } = event.detail
            if (data.source === 'local') return

            isImportingRef.current = true

            if (data.files) {
                setFiles(data.files)
                if (editorRef.current && data.activeIndex !== undefined) {
                    const activeIdx = data.activeIndex
                    const newContent = data.files[activeIdx]?.content
                    if (newContent !== undefined && newContent !== editorRef.current.getValue()) {
                        const position = editorRef.current.getPosition()
                        editorRef.current.setValue(newContent)
                        if (position) editorRef.current.setPosition(position)
                    }
                }
            }
            if (data.activeIndex !== undefined) {
                setActiveFileIndex(data.activeIndex)
            }

            setTimeout(() => {
                isImportingRef.current = false
            }, 100)
        }

        window.addEventListener('code_update' as any, handleCodeUpdate as EventListener)
        return () => window.removeEventListener('code_update' as any, handleCodeUpdate as EventListener)
    }, [sessionId])

    // Handle editor resize on visibility change
    useEffect(() => {
        if (isVisible && editorRef.current) {
            setTimeout(() => {
                editorRef.current?.layout()
            }, 100)
        }
    }, [isVisible])

    const handleEditorMount: OnMount = useCallback((editor) => {
        editorRef.current = editor

        // Initial layout trigger
        setTimeout(() => {
            editor.layout()
        }, 100)

        if (activeFile) {
            editor.setValue(activeFile.content)
        }
    }, [activeFile])

    const handleChange: OnChange = useCallback((value) => {
        if (isImportingRef.current || !activeFile) return
        const newContent = value || ''
        if (newContent === activeFile.content) return

        const newFiles = [...files]
        newFiles[activeFileIndex] = { ...activeFile, content: newContent }

        // Instant state update for responsiveness
        updateState(newFiles, activeFileIndex)
    }, [files, activeFileIndex, activeFile])

    const selectFile = (index: number) => {
        if (index === activeFileIndex) return
        updateState(files, index)
    }

    const addNewFile = () => {
        if (!newFileName.trim()) {
            setIsCreatingFile(false)
            return
        }

        const ext = newFileName.split('.').pop()?.toLowerCase() || ''
        const lang = LANGUAGE_MAP[ext] || 'javascript'
        const newFile: FileEntry = {
            name: newFileName,
            language: lang,
            content: LANGUAGE_TEMPLATES[lang] || ''
        }

        const newFiles = [...files, newFile]
        const newIndex = newFiles.length - 1
        updateState(newFiles, newIndex)

        setNewFileName('')
        setIsCreatingFile(false)
        if (editorRef.current) {
            editorRef.current.setValue(newFile.content)
        }
    }

    const handleLanguageChange = (newLang: string) => {
        if (!activeFile) return
        const newFiles = [...files]
        newFiles[activeFileIndex] = { ...activeFile, language: newLang }
        updateState(newFiles, activeFileIndex)
    }

    const deleteFile = (e: React.MouseEvent, index: number) => {
        e.stopPropagation()
        if (files.length <= 1) return

        const newFiles = files.filter((_, i) => i !== index)
        let newIndex = activeFileIndex
        if (index <= activeFileIndex) {
            newIndex = Math.max(0, activeFileIndex - 1)
        }

        updateState(newFiles, newIndex)
        if (editorRef.current) {
            editorRef.current.setValue(newFiles[newIndex].content)
        }
    }
    // Run Code State
    const [isRunning, setIsRunning] = useState(false)
    const [output, setOutput] = useState<{ stdout: string; stderr: string } | null>(null)
    const [isOutputVisible, setIsOutputVisible] = useState(false)

    const runCode = async () => {
        if (!activeFile) return

        setIsRunning(true)
        setIsOutputVisible(true)
        setOutput(null)

        const languageMap: Record<string, string> = {
            javascript: 'javascript',
            python: 'python',
            java: 'java',
            cpp: 'cpp',
            c: 'c',
        }

        // Piston API needs "python" not "py"
        const lang = languageMap[activeFile.language] || activeFile.language

        try {
            // Use local backend proxy to avoid CORS
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'}/execute/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Add auth token if needed, though this endpoint is public for now
                },
                body: JSON.stringify({
                    language: lang,
                    version: '*',
                    files: [{ content: activeFile.content }]
                })
            })

            if (!response.ok) {
                throw new Error(`Server returned ${response.status} ${response.statusText}`)
            }

            const data = await response.json()
            if (data.run) {
                setOutput({
                    stdout: data.run.stdout,
                    stderr: data.run.stderr
                })
            } else {
                setOutput({ stdout: '', stderr: 'Failed to execute code' })
            }
        } catch (error) {
            console.error('Run failed:', error)
            setOutput({ stdout: '', stderr: 'Network error or execution failed' })
        } finally {
            setIsRunning(false)
        }
    }

    if (!isVisible) return null

    const getIcon = (lang: string) => {
        switch (lang) {
            case 'javascript': return 'js'
            case 'python': return 'py'
            case 'java': return '☕'
            case 'cpp': return 'c++'
            case 'c': return 'c'
            case 'css': return '#'
            default: return 'txt'
        }
    }

    return (
        <div className="h-full flex flex-col bg-slate-900 overflow-hidden rounded-b-lg">
            {/* IDE Header */}
            <div className="flex items-center justify-between px-6 py-2 bg-slate-950 border-b border-primary/20 h-14">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <span className="text-xs uppercase font-extrabold text-slate-400 tracking-widest">Language:</span>
                        <select
                            value={activeFile?.language || 'javascript'}
                            onChange={(e) => handleLanguageChange(e.target.value)}
                            className="bg-primary/20 text-sm text-white font-bold border-2 border-primary/50 rounded-lg px-4 py-1.5 focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer hover:bg-primary/30"
                        >
                            <optgroup label="Web">
                                <option value="javascript">JavaScript</option>
                                <option value="css">CSS</option>
                                <option value="markdown">Markdown</option>
                            </optgroup>
                            <optgroup label="System/Scripting">
                                <option value="python">Python</option>
                                <option value="cpp">C++</option>
                                <option value="c">C</option>
                                <option value="java">Java</option>
                            </optgroup>
                        </select>
                    </div>

                    <button
                        onClick={runCode}
                        disabled={isRunning}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold text-xs tracking-wider transition-all ${isRunning
                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'
                            }`}
                    >
                        {isRunning ? 'RUNNING...' : '▶ RUN'}
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (activeFile?.content) {
                                navigator.clipboard.writeText(activeFile.content)
                                    .then(() => alert('Code copied!'))
                            }
                        }}
                        className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors bg-white/5 px-2 py-1 rounded"
                    >
                        COPY CODE
                    </button>
                    <span className="h-4 w-[1px] bg-white/10" />
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-slate-400">SYNCED</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* File Explorer */}
                <div className="w-52 bg-slate-900 border-r border-white/5 flex flex-col">
                    <div className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 flex justify-between items-center bg-slate-950">
                        <span>Explorer</span>
                        <button
                            onClick={() => setIsCreatingFile(true)}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-primary transition-all text-sm font-bold"
                            title="New File"
                        >
                            +
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto py-2">
                        {isCreatingFile && (
                            <div className="px-3 py-1">
                                <input
                                    autoFocus
                                    className="w-full bg-slate-800 border border-primary/50 rounded px-2 py-1 text-xs text-white focus:outline-none placeholder-slate-600"
                                    placeholder="name.py"
                                    value={newFileName}
                                    onChange={e => setNewFileName(e.target.value)}
                                    onBlur={addNewFile}
                                    onKeyDown={e => e.key === 'Enter' && addNewFile()}
                                />
                                <p className="text-[8px] text-slate-500 mt-1 italic">Press Enter to save</p>
                            </div>
                        )}
                        {files.map((file, i) => (
                            <div
                                key={file.name + i}
                                onClick={() => selectFile(i)}
                                className={clsx(
                                    'w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between group cursor-pointer border-l-2',
                                    activeFileIndex === i
                                        ? 'bg-primary/10 text-primary border-primary'
                                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border-transparent'
                                )}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <span className={clsx(
                                        "w-6 text-[10px] font-bold text-center py-0.5 rounded uppercase",
                                        activeFileIndex === i ? "bg-primary text-white" : "bg-white/10 text-slate-400"
                                    )}>
                                        {getIcon(file.language)}
                                    </span>
                                    <span className="truncate">{file.name}</span>
                                </div>
                                {files.length > 1 && (
                                    <button
                                        onClick={(e) => deleteFile(e, i)}
                                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 transition-opacity"
                                        title="Delete File"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Tabs */}
                    <div className="flex bg-slate-950 border-b border-white/5 overflow-x-auto no-scrollbar h-10">
                        {files.map((file, i) => (
                            <div
                                key={file.name + i}
                                onClick={() => selectFile(i)}
                                className={clsx(
                                    'px-4 py-2 text-xs cursor-pointer border-r border-white/5 transition-all min-w-[140px] flex items-center justify-between group relative',
                                    activeFileIndex === i
                                        ? 'bg-slate-900 text-slate-100'
                                        : 'bg-slate-950 text-slate-500 hover:text-slate-300'
                                )}
                            >
                                <span className="truncate mr-2 font-medium">{file.name}</span>
                                {activeFileIndex === i && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                            </div>
                        ))}
                    </div>

                    {/* Monaco Content */}
                    <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
                        {activeFile && (
                            <Editor
                                height="100%"
                                language={activeFile.language}
                                theme="vs-dark"
                                onMount={handleEditorMount}
                                onChange={handleChange}
                                options={{
                                    fontSize: 14,
                                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                    minimap: { enabled: false },
                                    scrollBeyondLastLine: false,
                                    padding: { top: 12 },
                                    lineNumbers: 'on',
                                    glyphMargin: false,
                                    folding: true,
                                    wordWrap: 'on',
                                    automaticLayout: true,
                                    scrollbar: {
                                        vertical: 'hidden',
                                        horizontal: 'hidden'
                                    }
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Status Bar */}
            <div className="bg-primary px-3 py-1 flex items-center justify-between text-[10px] font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-primary/90 transition-colors"
                onClick={() => setIsOutputVisible(!isOutputVisible)}
                title="Toggle Output Panel"
            >
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        COLLABORATION ACTIVE
                    </span>
                    <span className="opacity-60">{activeFile?.name}</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="opacity-60">UTF-8</span>
                    <span>{activeFile?.language}</span>
                    <span className="ml-2 bg-black/20 px-2 py-0.5 rounded">
                        {isOutputVisible ? 'Hide Output ▼' : 'Show Output ▲'}
                    </span>
                </div>
            </div>

            {/* Output Panel */}
            {isOutputVisible && (
                <div className="h-48 bg-[#1e1e1e] border-t border-white/10 flex flex-col font-mono text-xs">
                    <div className="flex items-center justify-between px-4 py-1 bg-black/40 border-b border-white/5">
                        <span className="font-bold text-slate-400">TERMINAL OUTPUT</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); setOutput(null); }}
                            className="text-[10px] text-slate-500 hover:text-white"
                        >
                            CLEAR
                        </button>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto whitespace-pre-wrap">
                        {isRunning ? (
                            <span className="text-yellow-500 animate-pulse">Running code...</span>
                        ) : output ? (
                            <>
                                {output.stdout && <div className="text-slate-300">{output.stdout}</div>}
                                {output.stderr && <div className="text-red-400 mt-2">{output.stderr}</div>}
                                {!output.stdout && !output.stderr && <div className="text-slate-500 italic">No output</div>}
                            </>
                        ) : (
                            <span className="text-slate-600 italic">Run code to see output here...</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
