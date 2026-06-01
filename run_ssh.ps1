
$password = "hDxsiKNSlsr6dMMe"

$server = "89.108.88.207"
$user = "root"

$ps = New-Object System.Diagnostics.Process
$ps.StartInfo.Filename = "ssh.exe"
$ps.StartInfo.UseShellExecute = $false
$ps.StartInfo.RedirectStandardInput = $true
$ps.StartInfo.RedirectStandardOutput = $true
$ps.StartInfo.RedirectStandardError = $true
$ps.StartInfo.CreateNoWindow = $true
$ps.StartInfo.Arguments = "-o StrictHostKeyChecking=no -o PreferredAuthentications=password $user@$server `"wget -O setup.sh https://raw.githubusercontent.com/denis22078533-coder/https---github.com-denis22078533-coder-BD-Poexali/main/setup.sh ; bash setup.sh`""

$ps.Start() | Out-Null
Start-Sleep -Milliseconds 2000
$ps.StandardInput.WriteLine($password)
$ps.StandardInput.Flush()
Start-Sleep -Milliseconds 5000

$output = $ps.StandardOutput.ReadToEnd()
$err = $ps.StandardError.ReadToEnd()
$ps.WaitForExit(30000)

Write-Output "=== STDOUT ==="
Write-Output $output
Write-Output "=== STDERR ==="
Write-Output $err
Write-Output "=== EXIT CODE ==="
Write-Output $ps.ExitCode
