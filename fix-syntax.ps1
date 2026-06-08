# fix-syntax.ps1
$serverFile = "build/server.js"

Write-Host "🔧 Corrigindo sintaxe do JavaScript..." -ForegroundColor Yellow

if (Test-Path $serverFile) {
    $content = Get-Content $serverFile -Raw
    
    # 1. Primeiro, vamos ver as linhas problemáticas (6210-6215)
    $lines = $content -split "`n"
    Write-Host "`n📋 Analisando linhas 6210-6215:" -ForegroundColor Cyan
    
    for ($i = 6208; $i -lt 6215; $i++) {
        if ($i -lt $lines.Count) {
            Write-Host "[$($i+1)] $($lines[$i].Trim())" -ForegroundColor Gray
        }
    }
    
    # 2. Corrigir o problema mais comum: chave solta
    # Encontra a área problemática
    $problemArea = ""
    for ($i = 6200; $i -lt 6220 -and $i -lt $lines.Count; $i++) {
        $problemArea += "[$($i+1)] " + $lines[$i] + "`n"
    }
    
    Write-Host "`n🔍 Área problemática encontrada:" -ForegroundColor Yellow
    Write-Host $problemArea
    
    # 3. Corrigir padrão comum: } catch (u) {
    $content = $content -replace '}\s+catch\s*\(\s*u\s*\)\s*{', '} catch (u) {'
    
    # 4. Se ainda tiver erro, substituir o bloco inteiro
    if ($content -match '}\s*\{\s*catch') {
        Write-Host "⚠️  Encontrado bloco mal formado. Corrigindo..." -ForegroundColor Red
        $content = $content -replace '}\s*\{\s*catch\s*\(', '} catch('
    }
    
    # 5. Verificar chaves desbalanceadas
    $openBraces = ($content | Select-String -Pattern '\{' -AllMatches).Matches.Count
    $closeBraces = ($content | Select-String -Pattern '\}' -AllMatches).Matches.Count
    
    Write-Host "`n📊 Balanceamento de chaves: {=$openBraces }=$closeBraces" -ForegroundColor Cyan
    if ($openBraces -ne $closeBraces) {
        Write-Host "⚠️  CHAVES DESBALANCEADAS! Diferença: $($openBraces - $closeBraces)" -ForegroundColor Red
        # Adiciona chave faltante no final se necessário
        if ($openBraces -gt $closeBraces) {
            $content += "`n}" * ($openBraces - $closeBraces)
            Write-Host "✅ Adicionadas $($openBraces - $closeBraces) chaves de fechamento" -ForegroundColor Green
        }
    }
    
    Set-Content $serverFile $content -Encoding UTF8
    Write-Host "`n✅ Sintaxe corrigida! Tente: npm start" -ForegroundColor Green
    
} else {
    Write-Host "❌ Arquivo não encontrado: $serverFile" -ForegroundColor Red
}