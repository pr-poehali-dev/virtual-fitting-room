import Layout from '@/components/Layout';
import TryOnImageUploadSection from '@/components/replicate/TryOnImageUploadSection';
import TryOnClothingSection from '@/components/replicate/TryOnClothingSection';
import TryOnControlsSection from '@/components/replicate/TryOnControlsSection';
import { useTryOnState } from '@/components/replicate/hooks/useTryOnState';

export default function ReplicateTryOn() {
  const {
    user,
    uploadedImage,
    setUploadedImage,
    selectedClothingItems,
    clothingCatalog,
    generatedImage,
    isGenerating,
    lookbooks,
    showSaveDialog,
    setShowSaveDialog,
    newLookbookName,
    setNewLookbookName,
    newLookbookPersonName,
    setNewLookbookPersonName,
    selectedLookbookId,
    setSelectedLookbookId,
    isSaving,
    filters,
    selectedCategories,
    setSelectedCategories,
    selectedColors,
    setSelectedColors,
    selectedArchetypes,
    setSelectedArchetypes,
    selectedGender,
    setSelectedGender,
    generationStatus,
    intermediateResult,
    currentStep,
    totalSteps,
    waitingContinue,
    showCropper,
    tempImageForCrop,
    handleImageUpload,
    handleCropComplete,
    handleCropCancel,
    handleSelectFromCatalog,
    handleRemoveClothing,
    handleGenerate,
    handleSaveImage,
    handleContinueGeneration,
    handleAcceptIntermediate
  } = useTryOnState();

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
              Виртуальная примерочная
            </h1>
            <p className="text-gray-600">
              Загрузите фото и выберите одежду для виртуальной примерки
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <TryOnImageUploadSection
                uploadedImage={uploadedImage}
                setUploadedImage={setUploadedImage}
                handleImageUpload={handleImageUpload}
                showCropper={showCropper}
                tempImageForCrop={tempImageForCrop}
                handleCropComplete={handleCropComplete}
                handleCropCancel={handleCropCancel}
              />

              <TryOnClothingSection
                clothingCatalog={clothingCatalog}
                selectedClothingItems={selectedClothingItems}
                filters={filters}
                selectedCategories={selectedCategories}
                selectedColors={selectedColors}
                selectedArchetypes={selectedArchetypes}
                selectedGender={selectedGender}
                setSelectedCategories={setSelectedCategories}
                setSelectedColors={setSelectedColors}
                setSelectedArchetypes={setSelectedArchetypes}
                setSelectedGender={setSelectedGender}
                handleSelectFromCatalog={handleSelectFromCatalog}
                handleRemoveClothing={handleRemoveClothing}
              />
            </div>

            <div className="space-y-6">
              <TryOnControlsSection
                isGenerating={isGenerating}
                generationStatus={generationStatus}
                currentStep={currentStep}
                totalSteps={totalSteps}
                waitingContinue={waitingContinue}
                intermediateResult={intermediateResult}
                generatedImage={generatedImage}
                user={user}
                showSaveDialog={showSaveDialog}
                lookbooks={lookbooks}
                selectedLookbookId={selectedLookbookId}
                newLookbookName={newLookbookName}
                newLookbookPersonName={newLookbookPersonName}
                isSaving={isSaving}
                handleGenerate={handleGenerate}
                handleContinueGeneration={handleContinueGeneration}
                handleAcceptIntermediate={handleAcceptIntermediate}
                setShowSaveDialog={setShowSaveDialog}
                setSelectedLookbookId={setSelectedLookbookId}
                setNewLookbookName={setNewLookbookName}
                setNewLookbookPersonName={setNewLookbookPersonName}
                handleSaveImage={handleSaveImage}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
