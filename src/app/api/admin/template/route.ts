export async function GET() {
  const headers = 'property_id,address,area,price_aed,bedrooms,bathrooms,size_sqft,status,developer,community,property_type,sold_date'
  const example = 'PROP001,123 Main Street,Dubai Marina,1500000,2,2,1200,available,Emaar,Marina Walk,apartment,'
  const csv = `${headers}\n${example}\n`
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="listings-template.csv"',
    },
  })
}
