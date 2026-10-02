# Generates docs/assets/example-orders.json (demo data, loaded with ?seed=1 in demo mode): 34 example orders / 55 product lines, all flagged sample=true.
# Deterministic (fixed random seed) so the file is stable between runs.
$root = Split-Path $PSScriptRoot -Parent
$rnd = New-Object System.Random 42
function Pick($arr) { $arr[$rnd.Next($arr.Count)] }

$companies = 'Northwind Dental','Brightside Realty','Cedar Ridge Golf Club','Harbor Credit Union','Summit Physio','Maple Leaf Brewing',
  'Blue Fin Marine','Oakwood School Board','Pioneer Logistics','Lumen Software','Riverbend Hospital','Granite Construction'
$people = 'Alex Morgan','Jordan Lee','Sam Patel','Taylor Chen','Casey Nguyen','Riley Brooks','Morgan Diaz','Jamie Walsh'
$titles = 'Marketing Manager','Office Manager','Events Coordinator','HR Director','Owner','Brand Lead'
$suppliers = @(
  @{n='Example Supplier A';r='Pat Quinn'},@{n='Example Supplier B';r='Drew Ellis'},@{n='Example Supplier C';r='Robin Shah'},@{n='Example Supplier D';r='Lee Park'})
$products = @(
  @{n='Insulated tumbler 20oz';c='Drinkware';d='Laser engraving';cost=6.10;price=13.50},
  @{n='Ceramic mug 11oz';c='Drinkware';d='Full-color digital';cost=2.40;price=6.95},
  @{n='Cotton t-shirt';c='Apparel';d='Screen print';cost=4.20;price=11.00},
  @{n='Quarter-zip pullover';c='Apparel';d='Embroidery';cost=18.50;price=39.00},
  @{n='Structured cap';c='Headwear';d='Embroidery';cost=5.80;price=14.50},
  @{n='Canvas tote';c='Bags';d='Screen print';cost=2.10;price=5.75},
  @{n='Laptop backpack';c='Bags';d='Embroidery';cost=19.00;price=42.00},
  @{n='Ballpoint pen';c='Writing';d='Pad print';cost=0.45;price=1.35},
  @{n='Power bank 5000mAh';c='Tech';d='Full-color digital';cost=8.90;price=19.95},
  @{n='Journal notebook';c='Office';d='Deboss/Emboss';cost=4.60;price=11.25},
  @{n='Retractable banner';c='Signage & Displays';d='Full-color digital';cost=85.00;price=179.00},
  @{n='Golf umbrella';c='Outdoor';d='Screen print';cost=9.40;price=22.00})
$reps = 'Rep 1','Rep 2','Rep 3'
$platforms = 'Stripe','PayPal','ACH / bank transfer','Check','Square','E-transfer'
$statusPool = 'Delivered','Delivered','Delivered','Delivered','Shipped','In Production','Ordered','Pending','Quote','Cancelled'
$ship = 'UPS','FedEx','Canada Post','Purolator'
$cac = 'Referral','Repeat client','Website','Cold outreach','LinkedIn','Trade show'

# 34 orders; line counts sum to 55
$lineCounts = @(1)*20 + @(2)*9 + @(3)*4 + @(4)*1   # 20+18+12+4 = 54
$lineCounts[0] = 2                                  # 55
$start = [datetime]'2025-01-06'
$lines = @()
for ($i = 0; $i -lt 34; $i++) {
  $orderDate = $start.AddDays([int]($i * 18.5) + $rnd.Next(0, 6))
  $status = if ($i -ge 31) { Pick @('Pending','Ordered','Quote') } else { Pick $statusPool }
  $company = Pick $companies
  $order = [ordered]@{
    priority = Pick @('Normal','Normal','Normal','High','Rush','Low')
    orderNumber = 'ORD-' + (1001 + $i)
    status = $status
    salesRep = $reps[$i % 3]
    orderDate = $orderDate.ToString('yyyy-MM-dd')
    inHandsDate = $orderDate.AddDays($rnd.Next(18, 32)).ToString('yyyy-MM-dd')
    cac = Pick $cac
    clientName = Pick $people
    clientTitle = Pick $titles
    companyName = "Example: $company"
    clientEmail = 'client' + (1001 + $i) + '@example.com'
    clientPhone = '555-01' + ('{0:D2}' -f ($i % 100))
    paymentPlatform = Pick $platforms
    deliveryAddress = "$(100 + $i) Example St, Springfield"
  }
  if ($status -in 'Delivered','Shipped') { $order.invoicePaidDate = $orderDate.AddDays($rnd.Next(1, 10)).ToString('yyyy-MM-dd') }
  for ($j = 0; $j -lt $lineCounts[$i]; $j++) {
    $p = Pick $products; $s = Pick $suppliers
    $qty = if ($p.c -eq 'Signage & Displays') { $rnd.Next(1, 6) } else { (Pick @(25,50,72,100,144,150,250,500)) }
    $line = [ordered]@{}; foreach ($k in $order.Keys) { $line[$k] = $order[$k] }
    $line.supplierName = $s.n; $line.supplierContactName = $s.r
    $line.supplierContactEmail = ($s.r -replace ' ', '.').ToLower() + '@example.com'
    $line.supplierContactPhone = '555-02' + ('{0:D2}' -f $rnd.Next(100))
    $line.productName = $p.n; $line.productCategory = $p.c; $line.decorationMethod = $p.d
    $line.supplierItem = 'SUP-' + $rnd.Next(10000, 99999); $line.websiteItem = 'WEB-' + $rnd.Next(1000, 9999)
    $line.quantity = $qty
    $line.unitCost = [math]::Round($p.cost * (0.9 + $rnd.NextDouble() * 0.2), 2)
    $line.setupCost = Pick @(0, 40, 50, 60, 75)
    $line.unitRunCharges = Pick @(0, 0, 0.25, 0.40, 0.60)
    $line.shippingCost = [math]::Round(15 + $qty * 0.12 + $rnd.Next(0, 40), 2)
    if ($rnd.Next(5) -eq 0) { $line.otherCosts = Pick @(25, 35, 50) }
    $line.customerUnitPrice = [math]::Round($p.price * (0.95 + $rnd.NextDouble() * 0.15), 2)
    if ($rnd.Next(3) -eq 0) { $line.commissionValue = Pick @(10, 20, 25, 40) }
    $line.platformFeeType = '%'
    if ($status -in 'Delivered','Shipped') {
      $shipped = $orderDate.AddDays($rnd.Next(8, 20))
      $line.poPaidDate = $orderDate.AddDays($rnd.Next(1, 5)).ToString('yyyy-MM-dd')
      $line.shippingCompany = Pick $ship
      $line.trackingNumber = '1Z' + $rnd.Next(100000000, 999999999)
      $line.shippedDate = $shipped.ToString('yyyy-MM-dd')
      if ($status -eq 'Delivered') { $line.deliveryDate = $shipped.AddDays($rnd.Next(2, 9)).ToString('yyyy-MM-dd') }
    }
    $line.inHandsAchieved = 'Auto'
    $line.sample = $true
    $lines += [pscustomobject]$line
  }
}
$json = $lines | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText((Join-Path $root 'docs\assets\example-orders.json'), $json, (New-Object Text.UTF8Encoding $false))
"Wrote $($lines.Count) lines across $(($lines | Select-Object -ExpandProperty orderNumber -Unique).Count) orders"
