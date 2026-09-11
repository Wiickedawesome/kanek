export interface TaxiAssociation {
  name: string;
  district: string;
  address?: string;
  phone?: string;
  notes?: string;
}

export const BELIZE_TAXI_ASSOCIATIONS: readonly TaxiAssociation[] = [
  {
    name: 'Bus Terminal & Market Square Taxi Cooperative Society Ltd.',
    district: 'Belize District',
    address: '111 N. Front St., Belize City',
    phone: '+501 675-0702',
    notes: "Belize's largest taxi co-op; 52 members; est. 2004; BTB Gold Standard; busterminaltaxicooperative@gmail.com",
  },
  {
    name: 'Radisson Fort George Taxi Association',
    district: 'Belize District',
    address: '2 Marine Parade, Belize City',
    phone: '+501 223-3333',
    notes: 'BTB Gold Standard certified; operates at Fort George Hotel area',
  },
  {
    name: 'Belizean Taxi Cooperative',
    district: 'Belize District',
    address: 'Corner St. Thomas & 12th St., Belize City',
    phone: '+501 601-9883',
    notes: 'Licensed co-op; weekdays 7AM–6PM; Sat until 8PM',
  },
  {
    name: 'Cinderella Plaza Taxi Stand',
    district: 'Belize District',
    address: 'Cinderella Plaza, Belize City',
    phone: '+501 203-3340',
    notes: 'Long-established stand; also listed at Freetown Rd location',
  },
  {
    name: 'Freetown Taxi Stall',
    district: 'Belize District',
    address: '1 Kelly St., Belize City',
    notes: 'Fort George neighborhood; listed in national business directories',
  },
  {
    name: 'Five Star Taxi Service',
    district: 'Belize District',
    address: 'N. Front St., Belize City',
    notes: 'Rated 4.5★; active stand near the water taxi terminal area',
  },
  {
    name: 'Taxi Garage Services',
    district: 'Belize District',
    address: 'Belize City',
    phone: '+501 227-3031',
    notes: 'Long-standing Belize City taxi dispatch',
  },
  {
    name: 'Majestic Taxi',
    district: 'Belize District',
    address: 'Belize City',
    phone: '+501 203-4465',
    notes: 'Documented dispatch service, Belize City',
  },
  {
    name: 'Ladyville Airport Taxi Association / Ladyville Airport Taxi Union',
    district: 'Belize District',
    address: 'Philip S.W. Goldson International Airport, Ladyville',
    phone: '+501 225-2125',
    notes: 'Official airport taxi service since 1985; BTB Gold Standard; ladyvilleairporttaxiservices@gmail.com; belizeairporttaxi.bz',
  },
  {
    name: 'Capital Taxi Association',
    district: 'Cayo District',
    address: 'Belmopan (near Market Square)',
    phone: '+501 607-7033',
    notes: 'Est. ~2023; Open 24 hours; rated 4.8★',
  },
  {
    name: 'Green Lights Taxi Stand',
    district: 'Cayo District',
    address: 'Belmopan',
    notes: 'Active stand in the capital city',
  },
  {
    name: 'Belmopan Taxi Stand',
    district: 'Cayo District',
    address: 'Belmopan Market area',
    notes: 'General taxi rank serving the capital',
  },
  {
    name: 'Santa Elena & San Ignacio Taxi Federation',
    district: 'Cayo District',
    address: 'San Ignacio / Santa Elena',
    notes: 'Active federation; operates across twin towns; Facebook page active',
  },
  {
    name: 'Savannah Taxi Association',
    district: 'Cayo District',
    address: 'San Ignacio',
    notes: 'Rated 4.0★; listed in national directories',
  },
  {
    name: 'Benque Viejo Taxi Association(s)',
    district: 'Cayo District',
    address: 'Benque Viejo del Carmen',
    notes: 'Formal associations registered and licensed under Benque Viejo Town Council',
  },
  {
    name: 'Orange Walk Premier Taxi Association',
    district: 'Orange Walk District',
    address: 'Cr. Queen Victoria Ave & Arthur St., Orange Walk Town',
    phone: '+501 630-3858',
    notes: 'Rated 4.3★; orange-walks-premier-taxi-association.business.site',
  },
  {
    name: 'Orange Walk Taxi Association',
    district: 'Orange Walk District',
    address: 'Queen Victoria Ave., Orange Walk Town',
    notes: 'Separately listed in FindYello national directory as a distinct association',
  },
  {
    name: 'Corozal Taxi Association',
    district: 'Corozal District',
    address: 'Park Street, Corozal Town',
    phone: '+501 422-2642',
    notes: 'Listed on FYIonBelize; Mon–Fri 9AM–5PM',
  },
  {
    name: 'Corozal Bus Terminal Taxi Association',
    district: 'Corozal District',
    address: 'Corozal Town (Bus Terminal)',
    notes: 'Formally listed as an association in the national FindYello directory',
  },
  {
    name: 'Dangriga Taxi Operators',
    district: 'Stann Creek District',
    address: 'Dangriga Town',
    notes: 'Informal association; operators active and licensed under the town',
  },
  {
    name: 'Placencia Taxi Co-operative Society Limited',
    district: 'Stann Creek District',
    address: 'Placencia Peninsula',
    notes: 'Officially registered April 6, 2024 by Dept. of Co-operatives; 20 members; serving Placencia and Seine Bight',
  },
  {
    name: 'Punta Gorda Taxi Association',
    district: 'Toledo District',
    address: 'Near Central Park, Punta Gorda Town',
    notes: 'Situated near Punta Gorda Airport and Central Park',
  },
  {
    name: 'Amber Isle Taxi',
    district: 'Belize District',
    address: 'Pescador Drive, San Pedro',
    notes: 'San Pedro-based taxi service; also operates bus routes since Oct 2025',
  },
  {
    name: 'Felix Taxi',
    district: 'Belize District',
    address: 'Pescador Dr / Pelican St, San Pedro',
    notes: 'Listed in FindYello national directory',
  },
  {
    name: 'Island Taxi',
    district: 'Belize District',
    address: 'Pescador Drive, San Pedro',
    notes: 'Golf cart–based island taxi service',
  },
  {
    name: 'Caye Caulker Taxi Service',
    district: 'Belize District',
    address: 'Caye Caulker Village',
    notes: 'Golf cart taxi service; meets passengers at the water taxi dock',
  },
] as const;
