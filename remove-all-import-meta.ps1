# remove-all-import-meta.ps1
$serverFile = "build/server.js"

Write-Host "🧹 Removendo TODAS as referências a import_meta..." -ForegroundColor Yellow

if (Test-Path $serverFile) {
    $content = Get-Content $serverFile -Raw
    
    # 1. Remove a linha que define import_meta como objeto vazio
    $content = $content -replace 'var import_meta = \{\};', '// import_meta removido'
    
    # 2. Remove QUALQUER uso de import_meta.url
    $content = $content -replace 'import_meta\.url', '""'
    
    # 3. Remove a linha específica do erro (6212)
    $lines = $content -split "`n"
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match 'require2 = __banner_node_module\.createRequire') {
            $lines[$i] = $lines[$i] -replace 'createRequire\([^)]+\)', 'createRequire("")'
        }
    }
    
    $content = $lines -join "`n"
    
    # 4. Remove todo o bloco do banner se ainda existir
    $content = $content -replace '(?s)var __filename2.*?fr = \(\(e5\).*?\)\(function\(e5\).*?\{.*?\}\)\)', ''
    
    Set-Content $serverFile $content -Encoding UTF8
    
    Write-Host "✅ TODAS as referências a import_meta foram removidas!" -ForegroundColor Green
    
    # Verificação
    $remaining = Select-String -Path $serverFile -Pattern "import_meta"
    if ($remaining) {
        Write-Host "⚠️  Ainda encontrado: $($remaining.Count) ocorrências" -ForegroundColor Yellow
        $remaining | ForEach-Object { Write-Host "   Linha $($_.LineNumber): $($_.Line.Trim())" }
    } else {
        Write-Host "✅ Nenhuma referência a import_meta encontrada!" -ForegroundColor Green
    }
} else {
    Write-Host "❌ Arquivo não encontrado: $serverFile" -ForegroundColor Red
}

Write-Host "`n🚀 Tente executar: npm start" -ForegroundColor Cyan