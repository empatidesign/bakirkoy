import { useState } from 'react'
import {
  TruckIcon,
  ShieldCheckIcon,
  
  
  
  
  
  
  FileTextIcon,
  CheckCircle2Icon,
  UploadIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  SearchIcon,
  SparklesIcon,
  Building2Icon,
  MapPinIcon,
  PhoneIcon
} from 'lucide-react'
import { ISTANBUL_HOSPITALS } from './hospitalsData'

export const AmbulansHastaNakilPortal = () => {
  const [activePortalTab, setActivePortalTab] = useState<'apply' | 'track'>('apply')
  const [currentStep, setCurrentStep] = useState<number>(1)
  
  // Takip No ve Sorgulama
  const [trackingSearchNo, setTrackingSearchNo] = useState('AMB-2026-000125')
  const [trackedStatus] = useState<any>({
    trackingNo: 'AMB-2026-000125',
    patientName: 'Ali Kemal Yıldırım',
    hospitalName: 'Bakırköy Dr. Sadi Konuk EAH',
    department: 'Kardiyoloji Polikliniği 3',
    appointmentDate: '2026-10-07',
    appointmentTime: '10:00',
    calculatedPickupTime: '08:35',
    status: 'YOLA_CIKTI',
    statusLabel: 'Ambulans Adresinize Doğru Yola Çıktı',
    ambulancePlate: '34 BKR 112',
    etaMinutes: 18,
    isTwentyMinNoticeSent: true,
    hasMissingDoc: false
  })

  // Adım 1: Başvuru Sahibi
  const [applicant, setApplicant] = useState({
    fullName: '',
    tckn: '',
    phone: '',
    email: '',
    address: '',
    relationship: 'KENDISI',
    relationshipOther: ''
  })

  // Adım 2: MERNİS & Hasta Doğrulama
  const [patientIdCheck, setPatientIdCheck] = useState({
    tckn: '',
    birthYear: '',
    verified: false,
    loading: false,
    hasActiveDuplicate: false,
    patientName: '',
    gender: 'ERKEK',
    age: 0
  })

  // Adım 3: Hasta Bilgisi ve Adres/Bina
  const [patientAddress, setPatientAddress] = useState({
    phone: '',
    altPhone: '',
    neighborhood: 'Zuhuratbaba Mah.',
    street: '',
    buildingNo: '',
    floor: '2',
    doorNo: '',
    hasElevator: true,
    stairAccessible: true,
    ambulanceStreetAccessible: true,
    accessNotes: ''
  })

  // Adım 4: Sağlık Bilgileri & Dinamik Alanlar
  const [healthProfile, setHealthProfile] = useState({
    diagnosis: '',
    transferReason: 'Hastane Kontrolü / Poliklinik',
    mobilityStatus: 'SEDYE',
    needsOxygen: false,
    oxygenType: 'Tüp / Konsantratör',
    oxygenFlowLpm: '2.5',
    portableOxygenRequired: true,
    hasTracheostomy: false,
    hasPeg: false,
    hasCatheter: false,
    hasIvSerum: false,
    isContagious: false,
    isConscious: true,
    companionRequired: true,
    weightKg: '75',
    medicalStaffRequired: true,
    notes: ''
  })

  // Adım 5: Nakil ve Randevu Bilgisi
  const [destination, setDestination] = useState({
    transferPurpose: 'Poliklinik Muayenesi',
    hospitalName: 'Bakırköy Dr. Sadi Konuk EAH',
    department: 'Dahiliye',
    doctorName: '',
    appointmentDate: '2026-10-15',
    appointmentTime: '10:00',
    isRoundTrip: true
  })

  // Adım 6: Yüklenen Belgeler
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])

  // Başvuru Tamamlandı Ekranı
  const [completedApplicationNo, setCompletedApplicationNo] = useState<string | null>(null)

  // MERNİS Doğrulama Simülasyonu
  const handleVerifyMernis = () => {
    if (patientIdCheck.tckn.length !== 11) {
      alert('Lütfen geçerli 11 haneli T.C. Kimlik Numarası giriniz.')
      return
    }
    setPatientIdCheck(prev => ({ ...prev, loading: true }))
    setTimeout(() => {
      setPatientIdCheck({
        tckn: patientIdCheck.tckn,
        birthYear: patientIdCheck.birthYear || '1954',
        verified: true,
        loading: false,
        hasActiveDuplicate: false,
        patientName: 'Ali Kemal Yıldırım',
        gender: 'ERKEK',
        age: 72
      })
    }, 800)
  }

  // Akıllı Zamanlama Hesaplama (Şartname Madde 20)
  const calculatePickupTime = (appTime: string) => {
    if (!appTime) return '08:35'
    const [h, m] = appTime.split(':').map(Number)
    let totalMinutes = h * 60 + m - 30 - 35 - 15 - 10 // 30 dk önce hastanede + 35 dk yol + 15 dk yükleme + 10 dk emniyet
    if (totalMinutes < 0) totalMinutes += 24 * 60
    const outH = Math.floor(totalMinutes / 60)
    const outM = totalMinutes % 60
    return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`
  }

  const recommendedPickup = calculatePickupTime(destination.appointmentTime)

  const handleCompleteSubmit = () => {
    const randomNo = `AMB-2026-${Math.floor(100000 + Math.random() * 900000)}`
    setCompletedApplicationNo(randomNo)
  }

  return (
    <div className="space-y-5">
      {/* Üst Sekmeler */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-surface-2 rounded-2xl border border-border">
        <button
          onClick={() => setActivePortalTab('apply')}
          className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activePortalTab === 'apply'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          <TruckIcon className="w-4 h-4 text-red-600" />
          Hasta Nakil Ön Başvurusu
        </button>
        <button
          onClick={() => setActivePortalTab('track')}
          className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activePortalTab === 'track'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          <SearchIcon className="w-4 h-4 text-blue-600" />
          Başvuru & Randevu Takibi
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SEKME 1: ÇOK ADIMLI ÖN BAŞVURU SİHİRBAZI                                  */}
      {/* ========================================================================= */}
      {activePortalTab === 'apply' && (
        <div className="space-y-4">
          {completedApplicationNo ? (
            <div className="p-6 rounded-3xl bg-card border border-border shadow-sm text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2Icon className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground">Ambulans Ön Başvurunuz Alındı!</h3>
                <p className="text-xs text-foreground-muted mt-1">
                  Başvurunuz sağlık ve triyaj ekibimize iletilmiştir. Değerlendirme sonucunda SMS ile bilgilendirileceksiniz.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-2 border border-border space-y-1 max-w-sm mx-auto">
                <div className="text-[10px] uppercase font-bold text-foreground-muted">Başvuru Takip Numaranız</div>
                <div className="text-2xl font-black font-mono text-red-600">{completedApplicationNo}</div>
                <div className="text-[10px] text-foreground-muted">
                  Bu numara ile durumunuzu portaldan anlık takip edebilirsiniz.
                </div>
              </div>

              <button
                onClick={() => {
                  setCompletedApplicationNo(null)
                  setCurrentStep(1)
                }}
                className="px-6 py-2.5 rounded-xl bg-foreground text-background text-xs font-bold"
              >
                Yeni Başvuru Yap
              </button>
            </div>
          ) : (
            <div className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-5">
              {/* Adım İlerleme Çubuğu */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span>Adım {currentStep} / 6</span>
                  <span className="text-[11px] text-red-600">
                    {currentStep === 1 && '1. Başvuru Sahibi'}
                    {currentStep === 2 && '2. Hasta Kimlik & MERNİS'}
                    {currentStep === 3 && '3. Adres & Bina Erişimi'}
                    {currentStep === 4 && '4. Sağlık & Cihaz Bilgileri'}
                    {currentStep === 5 && '5. Nakil & Hastane Randevusu'}
                    {currentStep === 6 && '6. Belge Yükleme & Onay'}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-600 transition-all duration-300"
                    style={{ width: `${(currentStep / 6) * 100}%` }}
                  />
                </div>
              </div>

              {/* ADIM 1: BAŞVURU SAHİBİ */}
              {currentStep === 1 && (
                <div className="space-y-3.5 text-xs">
                  <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-700 text-[11px] font-medium leading-relaxed">
                    * Başvuruyu hastanın kendisi veya bir yakını doldurabilir. İletişim bilgileri bilgilendirme mesajları için kullanılacaktır.
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-foreground-muted block mb-1">Hasta ile Yakınlık Dereceniz</label>
                    <select
                      value={applicant.relationship}
                      onChange={e => setApplicant({ ...applicant, relationship: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground font-medium"
                    >
                      <option value="KENDISI">Kendisi</option>
                      <option value="ANNE">Anne</option>
                      <option value="BABA">Baba</option>
                      <option value="ES">Eş</option>
                      <option value="COCUK">Çocuk</option>
                      <option value="KARDES">Kardeş</option>
                      <option value="TORUN">Torun</option>
                      <option value="AKRABA">Akraba</option>
                      <option value="VASI">Vasi</option>
                      <option value="BAKICI">Bakıcı</option>
                      <option value="DIGER">Diğer (Açıklayınız)</option>
                    </select>
                  </div>

                  {applicant.relationship === 'DIGER' && (
                    <div>
                      <label className="text-[11px] font-bold text-foreground-muted block mb-1">Yakınlık Açıklaması</label>
                      <input
                        type="text"
                        placeholder="Örn: Komşusu / Refakatçisi"
                        value={applicant.relationshipOther}
                        onChange={e => setApplicant({ ...applicant, relationshipOther: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-foreground-muted block mb-1">Başvuru Sahibi Adı Soyadı</label>
                      <input
                        type="text"
                        placeholder="Ad Soyad"
                        value={applicant.fullName}
                        onChange={e => setApplicant({ ...applicant, fullName: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground-muted block mb-1">T.C. Kimlik No</label>
                      <input
                        type="text"
                        maxLength={11}
                        placeholder="11 haneli TCKN"
                        value={applicant.tckn}
                        onChange={e => setApplicant({ ...applicant, tckn: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs font-mono text-foreground"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-foreground-muted block mb-1">Cep Telefonu</label>
                      <input
                        type="tel"
                        placeholder="05XX XXX XX XX"
                        value={applicant.phone}
                        onChange={e => setApplicant({ ...applicant, phone: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs font-mono text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground-muted block mb-1">E-Posta Adresi</label>
                      <input
                        type="email"
                        placeholder="ornek@email.com"
                        value={applicant.email}
                        onChange={e => setApplicant({ ...applicant, email: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ADIM 2: HASTA KİMLİK & MERNİS DOĞRULAMA */}
              {currentStep === 2 && (
                <div className="space-y-4 text-xs">
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 text-[11px]">
                    <strong>MERNİS / KPS Doğrulaması:</strong> Taşınacak hastanın T.C. Kimlik Numarası ve doğum yılı Nüfus ve Vatandaşlık İşleri Genel Müdürlüğü servisinden anlık teyit edilir.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-foreground-muted block mb-1">Hasta T.C. Kimlik No</label>
                      <input
                        type="text"
                        maxLength={11}
                        placeholder="11 haneli TCKN"
                        value={patientIdCheck.tckn}
                        onChange={e => setPatientIdCheck({ ...patientIdCheck, tckn: e.target.value, verified: false })}
                        className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs font-mono text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground-muted block mb-1">Doğum Yılı</label>
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="Örn: 1952"
                        value={patientIdCheck.birthYear}
                        onChange={e => setPatientIdCheck({ ...patientIdCheck, birthYear: e.target.value, verified: false })}
                        className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs font-mono text-foreground"
                      />
                    </div>
                  </div>

                  {!patientIdCheck.verified ? (
                    <button
                      type="button"
                      onClick={handleVerifyMernis}
                      disabled={patientIdCheck.loading || patientIdCheck.tckn.length !== 11}
                      className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      <ShieldCheckIcon className="w-4 h-4" />
                      {patientIdCheck.loading ? 'MERNİS Sorgulanıyor...' : 'Kimlik ve MERNİS Bilgilerini Doğrula'}
                    </button>
                  ) : (
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <CheckCircle2Icon className="w-4 h-4 text-emerald-600" />
                        MERNİS Doğrulaması Başarılı
                      </div>
                      <div className="text-[11px]">
                        Hasta: <strong>{patientIdCheck.patientName}</strong> ({patientIdCheck.age} Yaş, {patientIdCheck.gender})
                      </div>
                      <div className="text-[10px] text-emerald-700">
                        ✓ Aktif mükerrer başvuru kontrolü yapıldı (Müsait).
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ADIM 3: ADRES & BİNA ERİŞİMİ */}
              {currentStep === 3 && (
                <div className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-foreground-muted block mb-1">Mahalle</label>
                      <select
                        value={patientAddress.neighborhood}
                        onChange={e => setPatientAddress({ ...patientAddress, neighborhood: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground font-medium"
                      >
                        <option>Zuhuratbaba Mah.</option>
                        <option>Kartaltepe Mah.</option>
                        <option>Ataköy 1. Kısım</option>
                        <option>Ataköy 2-5-6. Kısım</option>
                        <option>Ataköy 7-8-9-10. Kısım</option>
                        <option>Yeşilköy Mah.</option>
                        <option>Yeşilyurt Mah.</option>
                        <option>Osmaniye Mah.</option>
                        <option>Cevizlik Mah.</option>
                        <option>Yenimahalle</option>
                        <option>Sakızağacı Mah.</option>
                        <option>Şenlikköy (Florya)</option>
                        <option>Basınköy Mah.</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground-muted block mb-1">Cadde / Sokak</label>
                      <input
                        type="text"
                        placeholder="Örn: İncirli Cad."
                        value={patientAddress.street}
                        onChange={e => setPatientAddress({ ...patientAddress, street: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-foreground-muted block mb-1">Bina No</label>
                      <input
                        type="text"
                        placeholder="No"
                        value={patientAddress.buildingNo}
                        onChange={e => setPatientAddress({ ...patientAddress, buildingNo: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground-muted block mb-1">Kat</label>
                      <input
                        type="text"
                        placeholder="Kat"
                        value={patientAddress.floor}
                        onChange={e => setPatientAddress({ ...patientAddress, floor: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground-muted block mb-1">Daire No</label>
                      <input
                        type="text"
                        placeholder="Daire"
                        value={patientAddress.doorNo}
                        onChange={e => setPatientAddress({ ...patientAddress, doorNo: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground"
                      />
                    </div>
                  </div>

                  {/* Bina Erişim Kriterleri (Şartname Madde 4) */}
                  <div className="p-3.5 rounded-2xl bg-surface-2 border border-border space-y-2.5">
                    <div className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                      Ambulans ve Sedye Erişim Bilgileri:
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-foreground">Binada asansör var mı? (Sedye sığıyor mu?)</span>
                      <input
                        type="checkbox"
                        checked={patientAddress.hasElevator}
                        onChange={e => setPatientAddress({ ...patientAddress, hasElevator: e.target.checked })}
                        className="w-4 h-4 rounded text-red-600"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-foreground">Hasta merdiven basamağı kullanabilir mi?</span>
                      <input
                        type="checkbox"
                        checked={patientAddress.stairAccessible}
                        onChange={e => setPatientAddress({ ...patientAddress, stairAccessible: e.target.checked })}
                        className="w-4 h-4 rounded text-red-600"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-foreground">Ambulans apartman kapısına kadar yanaşabilir mi?</span>
                      <input
                        type="checkbox"
                        checked={patientAddress.ambulanceStreetAccessible}
                        onChange={e => setPatientAddress({ ...patientAddress, ambulanceStreetAccessible: e.target.checked })}
                        className="w-4 h-4 rounded text-red-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ADIM 4: HASTALIK VE SAĞLIK BİLGİLERİ */}
              {currentStep === 4 && (
                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-foreground-muted block mb-1">Hastalık / Teşhis</label>
                    <input
                      type="text"
                      placeholder="Örn: Kronik Kalp Yetmezliği, KOAH, Kalça Kırığı"
                      value={healthProfile.diagnosis}
                      onChange={e => setHealthProfile({ ...healthProfile, diagnosis: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-foreground-muted block mb-1">Hastanın Hareket Kabiliyeti</label>
                    <select
                      value={healthProfile.mobilityStatus}
                      onChange={e => setHealthProfile({ ...healthProfile, mobilityStatus: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground font-medium"
                    >
                      <option value="YATAGA_BAGIMLI">Tamamen Yatağa Bağımlı (Sedye İle Transfer)</option>
                      <option value="SEDYE">Sedye Gerekiyor (Kısmi Hareketli)</option>
                      <option value="TEKERLEKLI_SANDALYE">Tekerlekli Sandalye Kullanıyor</option>
                      <option value="AYAKTA">Ayakta / Destekle Yürüyebiliyor</option>
                    </select>
                  </div>

                  {/* Oksijen İhtiyacı Dinamik Alan (Şartname Madde 5) */}
                  <div className="p-3.5 rounded-2xl bg-surface-2 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">Sürekli Oksijen Desteği Gerekiyor mu?</span>
                      <input
                        type="checkbox"
                        checked={healthProfile.needsOxygen}
                        onChange={e => setHealthProfile({ ...healthProfile, needsOxygen: e.target.checked })}
                        className="w-4 h-4 rounded text-red-600"
                      />
                    </div>

                    {healthProfile.needsOxygen && (
                      <div className="pt-2 border-t border-border grid grid-cols-2 gap-2 animate-in fade-in">
                        <div>
                          <label className="text-[10px] font-bold text-foreground-muted block mb-1">Akış Hızı (Litre/Dk)</label>
                          <input
                            type="text"
                            placeholder="Örn: 2.5 L/dk"
                            value={healthProfile.oxygenFlowLpm}
                            onChange={e => setHealthProfile({ ...healthProfile, oxygenFlowLpm: e.target.value })}
                            className="w-full p-2 rounded-xl bg-card border border-border text-xs text-foreground"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-foreground-muted block mb-1">Taşınabilir O2 Tüpü</label>
                          <select
                            value={healthProfile.portableOxygenRequired ? 'EVET' : 'HAYIR'}
                            onChange={e => setHealthProfile({ ...healthProfile, portableOxygenRequired: e.target.value === 'EVET' })}
                            className="w-full p-2 rounded-xl bg-card border border-border text-xs text-foreground"
                          >
                            <option value="EVET">Evet, Gereklidir</option>
                            <option value="HAYIR">Hayır</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tıbbi Cihaz ve Refakatçi Seçenekleri */}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="p-2.5 rounded-xl bg-surface-2 border border-border flex items-center justify-between cursor-pointer">
                      <span className="text-[11px] text-foreground">PEG (Mide Tüpü)</span>
                      <input
                        type="checkbox"
                        checked={healthProfile.hasPeg}
                        onChange={e => setHealthProfile({ ...healthProfile, hasPeg: e.target.checked })}
                      />
                    </label>
                    <label className="p-2.5 rounded-xl bg-surface-2 border border-border flex items-center justify-between cursor-pointer">
                      <span className="text-[11px] text-foreground">Trakeostomi</span>
                      <input
                        type="checkbox"
                        checked={healthProfile.hasTracheostomy}
                        onChange={e => setHealthProfile({ ...healthProfile, hasTracheostomy: e.target.checked })}
                      />
                    </label>
                    <label className="p-2.5 rounded-xl bg-surface-2 border border-border flex items-center justify-between cursor-pointer">
                      <span className="text-[11px] text-foreground">İdrar Sondası / Kateter</span>
                      <input
                        type="checkbox"
                        checked={healthProfile.hasCatheter}
                        onChange={e => setHealthProfile({ ...healthProfile, hasCatheter: e.target.checked })}
                      />
                    </label>
                    <label className="p-2.5 rounded-xl bg-surface-2 border border-border flex items-center justify-between cursor-pointer">
                      <span className="text-[11px] text-foreground">ATT/Paramedik Eşliği</span>
                      <input
                        type="checkbox"
                        checked={healthProfile.medicalStaffRequired}
                        onChange={e => setHealthProfile({ ...healthProfile, medicalStaffRequired: e.target.checked })}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* ADIM 5: NAKİL VE HASTANE RANDEVUSU */}
              {currentStep === 5 && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-foreground-muted block mb-1">
                      Hedef Sağlık Kuruluşu (İstanbul Geneli - {ISTANBUL_HOSPITALS.length} Merkez)
                    </label>
                    <select
                      value={destination.hospitalName}
                      onChange={e => setDestination({ ...destination, hospitalName: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground font-semibold"
                    >
                      <optgroup label="Bakırköy İlçe Hastaneleri (Öncelikli)">
                        {ISTANBUL_HOSPITALS.filter(h => h.district === 'Bakırköy').map(h => (
                          <option key={h.id} value={h.name}>
                            {h.name} (~{h.estimatedMinutesFromBakirkoy} dk)
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Şehir & Eğitim Araştırma Hastaneleri (EAH)">
                        {ISTANBUL_HOSPITALS.filter(h => (h.type === 'SEHIR' || h.type === 'EAH') && h.district !== 'Bakırköy').map(h => (
                          <option key={h.id} value={h.name}>
                            {h.name} ({h.district} - ~{h.estimatedMinutesFromBakirkoy} dk)
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Üniversite Tıp Fakültesi Hastaneleri">
                        {ISTANBUL_HOSPITALS.filter(h => h.type === 'UNIVERSITE').map(h => (
                          <option key={h.id} value={h.name}>
                            {h.name} ({h.district} - ~{h.estimatedMinutesFromBakirkoy} dk)
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Devlet ve Dal Hastaneleri">
                        {ISTANBUL_HOSPITALS.filter(h => (h.type === 'DEVLET' || h.type === 'DAL') && h.district !== 'Bakırköy').map(h => (
                          <option key={h.id} value={h.name}>
                            {h.name} ({h.district})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Özel Sağlık Grupları ve Hastaneler">
                        {ISTANBUL_HOSPITALS.filter(h => h.type === 'OZEL' && h.district !== 'Bakırköy').map(h => (
                          <option key={h.id} value={h.name}>
                            {h.name} ({h.district})
                          </option>
                        ))}
                      </optgroup>
                    </select>

                    {/* Seçili Hastane Detay Kartı */}
                    {(() => {
                      const hosp = ISTANBUL_HOSPITALS.find(h => h.name === destination.hospitalName || h.shortName === destination.hospitalName) || ISTANBUL_HOSPITALS[0]
                      return (
                        <div className="mt-2 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] space-y-1.5">
                          <div className="flex items-center justify-between font-bold text-foreground">
                            <span className="flex items-center gap-1">
                              <Building2Icon className="w-3.5 h-3.5 text-blue-600" />
                              {hosp.name}
                            </span>
                            <span className="text-[10px] text-blue-700 bg-blue-500/20 px-1.5 py-0.2 rounded font-mono">
                              ~{hosp.estimatedMinutesFromBakirkoy} dk sevk süresi
                            </span>
                          </div>
                          <div className="flex items-start gap-1 text-foreground-muted">
                            <MapPinIcon className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                            <span>{hosp.address}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-blue-500/20">
                            <span className="flex items-center gap-1 text-blue-700 font-semibold">
                              <PhoneIcon className="w-3 h-3" /> Santral: {hosp.phone}
                            </span>
                            <span className="font-bold text-emerald-700">
                              {hosp.hasEmergency ? '✓ 24 Saat Acil Servis Açık' : 'Randevulu Sevk'}
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-foreground-muted block mb-1">Klinik / Poliklinik</label>
                      <input
                        type="text"
                        placeholder="Örn: Kardiyoloji, Göz, FTR"
                        value={destination.department}
                        onChange={e => setDestination({ ...destination, department: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground-muted block mb-1">Doktor Adı (Varsa)</label>
                      <input
                        type="text"
                        placeholder="Örn: Dr. Ahmet Yılmaz"
                        value={destination.doctorName}
                        onChange={e => setDestination({ ...destination, doctorName: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-foreground-muted block mb-1">Hastane Randevu Tarihi</label>
                      <input
                        type="date"
                        value={destination.appointmentDate}
                        onChange={e => setDestination({ ...destination, appointmentDate: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs font-mono text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground-muted block mb-1">Hastane Randevu Saati</label>
                      <input
                        type="time"
                        value={destination.appointmentTime}
                        onChange={e => setDestination({ ...destination, appointmentTime: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs font-mono text-foreground"
                      />
                    </div>
                  </div>

                  {/* AKILLI ZAMANLAMA BİLGİLENDİRMESİ (Şartname Madde 20) */}
                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200 text-xs">
                      <SparklesIcon className="w-4 h-4 text-blue-600" />
                      Akıllı Ambulans Zaman Hesabı
                    </div>
                    <div className="text-[11px] text-foreground-muted leading-relaxed">
                      Hastane randevunuz <strong>{destination.appointmentTime}</strong> için tahmini yol ve hazırlık süresi hesaplanmıştır:
                    </div>
                    <div className="p-2.5 rounded-xl bg-background border border-blue-500/30 flex items-center justify-between text-xs font-bold text-foreground">
                      <span>💡 Önerilen Evden Alış Saati:</span>
                      <span className="font-mono text-blue-600 text-sm">{recommendedPickup}</span>
                    </div>
                  </div>

                  <label className="p-3 rounded-2xl bg-surface-2 border border-border flex items-center justify-between cursor-pointer">
                    <span className="text-[11px] font-bold text-foreground">Hastaneden Eve Geri Dönüş Nakli de İstiyorum</span>
                    <input
                      type="checkbox"
                      checked={destination.isRoundTrip}
                      onChange={e => setDestination({ ...destination, isRoundTrip: e.target.checked })}
                      className="w-4 h-4 rounded text-red-600"
                    />
                  </label>
                </div>
              )}

              {/* ADIM 6: BELGE YÜKLEME VE TAMAMLAMA */}
              {currentStep === 6 && (
                <div className="space-y-4 text-xs">
                  <div className="p-3.5 rounded-2xl bg-surface-2 border border-border space-y-2">
                    <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                      <UploadIcon className="w-4 h-4 text-red-600" />
                      Gerekli Belgeler (PDF, JPG veya PNG)
                    </div>
                    <p className="text-[11px] text-foreground-muted">
                      Hastane MHRS randevu onay belgesi, epikriz veya sağlık kurulu raporunu yükleyiniz.
                    </p>

                    <label className="block p-4 rounded-2xl border-2 border-dashed border-border hover:border-red-500/50 cursor-pointer text-center bg-card transition-all">
                      <FileTextIcon className="w-6 h-6 text-foreground-muted mx-auto mb-1" />
                      <span className="font-bold text-red-600 block text-xs">Belge Seç veya Sürükle</span>
                      <span className="text-[10px] text-foreground-muted">Maksimum 10 MB</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={e => {
                          if (e.target.files && e.target.files[0]) {
                            setUploadedFiles([...uploadedFiles, e.target.files[0].name])
                          }
                        }}
                      />
                    </label>

                    {uploadedFiles.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {uploadedFiles.map((f, i) => (
                          <div key={i} className="p-2 rounded-xl bg-card border border-border flex items-center justify-between text-[11px]">
                            <span>{f}</span>
                            <span className="text-emerald-600 font-bold">Yüklendi</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Özet ve Taahhüt */}
                  <div className="p-3.5 rounded-2xl bg-surface-2 border border-border space-y-2 text-[11px]">
                    <div className="font-bold text-foreground">Başvuru Özeti:</div>
                    <div>Hasta: <strong>{patientIdCheck.patientName || 'Ali Kemal Yıldırım'}</strong></div>
                    <div>Adres: <strong>{patientAddress.neighborhood}</strong></div>
                    <div>Hastane: <strong>{destination.hospitalName} ({destination.appointmentDate} - {destination.appointmentTime})</strong></div>
                    <div>Tahmini Alma Saati: <strong className="text-red-600">{recommendedPickup}</strong></div>
                  </div>
                </div>
              )}

              {/* İleri / Geri Butonları */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(prev => prev - 1)}
                    className="px-4 py-2.5 rounded-xl border border-border text-foreground font-bold text-xs flex items-center gap-1.5"
                  >
                    <ArrowLeftIcon className="w-4 h-4" />
                    Geri
                  </button>
                ) : (
                  <div></div>
                )}

                {currentStep < 6 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (currentStep === 2 && !patientIdCheck.verified) {
                        handleVerifyMernis()
                      }
                      setCurrentStep(prev => prev + 1)
                    }}
                    className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-500/20"
                  >
                    <span>Devam Et</span>
                    <ArrowRightIcon className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCompleteSubmit}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                  >
                    <CheckCircle2Icon className="w-4 h-4" />
                    <span>Ön Başvuruyu Tamamla</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEKME 2: CANLI BAŞVURU & RANDEVU TAKİP EKRANI                             */}
      {/* ========================================================================= */}
      {activePortalTab === 'track' && (
        <div className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-foreground">Ambulans Takip ve Durum Sorgulama</h3>
            <p className="text-xs text-foreground-muted">
              Başvuru takip numaranız ile nakil sürecini, tahmini geliş süresini canlı takip edebilirsiniz.
            </p>
          </div>

          {/* Sorgu Çubuğu */}
          <div className="flex gap-2">
            <input
              type="text"
              value={trackingSearchNo}
              onChange={e => setTrackingSearchNo(e.target.value)}
              placeholder="Örn: AMB-2026-000125"
              className="flex-1 p-2.5 rounded-xl bg-surface-2 border border-border text-xs font-mono font-bold text-foreground uppercase"
            />
            <button
              onClick={() => {
                alert(`${trackingSearchNo} sorgulandı: Durum güncel.`)
              }}
              className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <SearchIcon className="w-3.5 h-3.5" />
              Sorgula
            </button>
          </div>

          {trackedStatus && (
            <div className="space-y-4 pt-2 border-t border-border">
              {/* Canlı Durum Kartı (Şartname Madde 33, 34, 36) */}
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-700">{trackedStatus.trackingNo}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white">
                    {trackedStatus.status}
                  </span>
                </div>
                <div className="text-sm font-black text-blue-900 dark:text-blue-100">
                  {trackedStatus.statusLabel}
                </div>
                <div className="text-xs text-foreground-muted">
                  Ambulans Plakası: <strong>{trackedStatus.ambulancePlate}</strong> • Tahmini Adrese Ulaşım: <strong className="text-blue-600">{trackedStatus.etaMinutes} Dakika</strong>
                </div>

                {/* 20 Dk Öncesi Bildirim Rozeti (Şartname Madde 33) */}
                {trackedStatus.isTwentyMinNoticeSent && (
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-[10px] font-bold flex items-center gap-1.5">
                    <CheckCircle2Icon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    SMS İletildi: "Ambulansımız yaklaşık 20 dakika içinde adresinize ulaşacaktır. Lütfen hastayı hazır bulundurunuz."
                  </div>
                )}
              </div>

              {/* Randevu Bilgileri */}
              <div className="p-3.5 rounded-2xl bg-surface-2 border border-border space-y-1 text-xs">
                <div>Hasta: <strong>{trackedStatus.patientName}</strong></div>
                <div>Kurum: <strong>{trackedStatus.hospitalName} ({trackedStatus.department})</strong></div>
                <div>Randevu Saati: <strong className="font-mono">{trackedStatus.appointmentTime}</strong></div>
                <div>Tahmini Alınış Saati: <strong className="font-mono text-red-600">{trackedStatus.calculatedPickupTime}</strong></div>
              </div>

              {/* İptal Butonu (Şartname Madde 54) */}
              <button
                onClick={() => {
                  const reason = prompt('Randevuyu iptal etme gerekçenizi seçiniz:\n1. Hastane randevusu iptal edildi\n2. Hasta rahatsızlandı\n3. Kendi imkanımızla gideceğiz\n4. Diğer')
                  if (reason) {
                    alert('Randevunuz belediye iptal protokolü çerçevesinde iptal edildi.')
                  }
                }}
                className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-600 hover:bg-red-500/10 text-xs font-bold transition-all"
              >
                Randevuyu İptal Et
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
