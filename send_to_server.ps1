Accparam(
    [string]$Action = "check"
)

$server = "89.108.88.207"
$user = "root"
$password = "hDxsiKNSlsr6dMMe"

# Создаём ProcessStartInfo для SSH
function Run-SSHCommand {
    param([string]$Command)
    
    $ps = new-object System.Diagnostics.Process
    $ps.StartInfo.Filename = "ssh.exe"
    $ps.StartInfo.UseShellExecute = $false
    $ps.StartInfo.RedirectStandardOutput = $true
    $ps.StartInfo.RedirectStandardError = $true
    $ps.StartInfo.CreateNoWindow = $true
    $ps.StartInfo.Arguments = "-o StrictHostKeyChecking=no -o PreferredAuthentications=password $user@$server $Command"
    
    $ps.Start() | Out-Null

    # Подождать запрос пароля
    Start-Sleep -Milliseconds 500
    
    # Отправить пароль
    $ps.StandardInput.WriteLine($password)
    
    $output = $ps.StandardOutput.ReadToEnd()
    $error = $ps.StandardError.ReadToEnd()
    $ps.WaitForExit()
    
    return $output + $error
}

function Copy-File {
    param([string]$LocalPath, [string]$RemotePath)
    
    $ps = new-object System.Diagnostics.Process
    $ps.StartInfo.Filename = "scp.exe"
    $ps.StartInfo.UseShellExecute = $false
    $ps.StartInfo.RedirectStandardInput = $true
    $ps.StartInfo.RedirectStandardOutput = $true
    $ps.StartInfo.RedirectStandardError = $true
    $ps.StartInfo.CreateNoWindow = $true
    $ps.StartInfo.Arguments = "-o StrictHostKeyChecking=no -o PreferredAuthentications=password $LocalPath ${user}@${server}:$RemotePath"
    
    $ps.Start() | Out-Null
    Start-Sleep -Milliseconds 1000
    $ps.StandardInput.WriteLine($password)
    
    $output = $ps.StandardOutput.ReadToEnd()
    $error = $ps.StandardError.ReadToEnd()
    $ps.WaitForExit()
    
    return $output + $error
}

if ($Action -eq "check") {
    $result = Run-SSHCommand "ls -la /root/app/"
    Write-Output $result
} elseif ($Action -eq "copy") {
    $result = Copy-File $env:TEMP\api.zip "/root/app/api.zip"
    Write-Output $result
} elseif ($Action -eq "unzip") {
    $result = Run-SSHCommand "cd /root/app && mkdir -p api && unzip -o api.zip -d api_temp && cp -r api_temp/*/* api/ && rm -rf api_temp"
    Write-Output $result
} elseif ($Action -eq "install") {
    $result = Run-SSHCommand "cd /root/app/api && pip install --upgrade pip && pip install -r requirements.txt"
    Write-Output $result
} elseif ($Action -eq "run") {
    $result = Run-SSHCommand "cd /root/app/api && nohup uvicorn main:app --host 0.0.0.0 --port 8000 > /root/app/api/server.log 2>&1 &"
    Write-Output $result
    Start-Sleep -Seconds 3
    $result2 = Run-SSHCommand "curl -s http://localhost:8000/docs || echo 'Waiting...'"
    Write-Output $result2
}
