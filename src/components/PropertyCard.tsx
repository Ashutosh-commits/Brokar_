import { useState } from 'react';
import { Property } from '../types/property';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { ImageWithFallback } from './figma/ImageWithFallback';
import {
  Bed,
  Bath,
  Maximize,
  MapPin,
  TrendingUp,
  Calendar,
  ChevronDown,
  ChevronUp,
  Heart,
  GitCompare,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  calculatePricePrediction,
  formatCurrency,
  generatePredictionData
} from '../utils/priceCalculator';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { trackPropertyView } from '../lib/activityTracking';

interface PropertyCardProps {
  property: Property;
  isFavorite?: boolean;
  onToggleFavorite?: (propertyId: string) => void;
  isComparing?: boolean;
  onToggleCompare?: (propertyId: string) => void;
}

// Source label + colour map
const SOURCE_META: Record<string, { label: string; color: string }> = {
  "99acres":     { label: "99acres",     color: "bg-orange-100 text-orange-700 border-orange-200" },
  "magicbricks": { label: "MagicBricks", color: "bg-purple-100 text-purple-700 border-purple-200" },
  "manual":      { label: "Listed",      color: "bg-green-100  text-green-700  border-green-200"  },
};

export function PropertyCard({
  property,
  isFavorite = false,
  onToggleFavorite,
  isComparing = false,
  onToggleCompare,
}: PropertyCardProps) {
  const [predictionYears, setPredictionYears] = useState(5);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxImageIndex, setLightboxImageIndex] = useState(0);

  const images = property.images?.length ? property.images : [property.imageUrl];

  const nextImage = () => setCurrentImageIndex((p) => (p + 1) % images.length);
  const prevImage = () => setCurrentImageIndex((p) => (p - 1 + images.length) % images.length);
  const nextLightboxImage = () => setLightboxImageIndex((p) => (p + 1) % images.length);
  const prevLightboxImage = () => setLightboxImageIndex((p) => (p - 1 + images.length) % images.length);
  const openLightbox = (index: number) => { setLightboxImageIndex(index); setIsLightboxOpen(true); };

  const predictedPrice = calculatePricePrediction(property, predictionYears);
  const priceIncrease = predictedPrice - property.currentPrice;
  const percentageIncrease = ((priceIncrease / property.currentPrice) * 100).toFixed(1);
  const chartData = generatePredictionData(property, predictionYears);

  // ── "View Details" handler ────────────────────────────────────────────────
  const handleViewDetails = () => {
    trackPropertyView(property.id);
    if (property.sourceUrl) {
      window.open(property.sourceUrl, "_blank", "noopener,noreferrer");
    }
  };

  const sourceMeta = property.source ? SOURCE_META[property.source] : null;

  return (
    <Card id={`property-${property.id}`} className="overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-300">

      {/* ── Image Carousel ─────────────────────────────────────────────────── */}
      <div className="relative h-64 overflow-hidden group">
        {images.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-500 cursor-pointer ${
              index === currentImageIndex ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => openLightbox(currentImageIndex)}
          >
            <ImageWithFallback
              src={image}
              alt={`${property.title} - Image ${index + 1}`}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          </div>
        ))}

        <Badge className="absolute top-4 right-4 bg-white/90 text-black">
          {property.propertyType}
        </Badge>
        <Badge className="absolute top-14 right-4 bg-primary/90 text-primary-foreground">
          {property.bhkType}
        </Badge>

        {/* Source badge (99acres / MagicBricks) */}
        {sourceMeta && (
          <Badge
            className={`absolute top-4 left-4 border text-xs font-medium ${sourceMeta.color}`}
          >
            {sourceMeta.label}
          </Badge>
        )}

        {images.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={prevImage}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={nextImage}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </>
        )}

        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`transition-all ${
                  index === currentImageIndex
                    ? 'w-6 h-2 bg-white rounded-full'
                    : 'w-2 h-2 bg-white/50 hover:bg-white/75 rounded-full'
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        )}

        {(onToggleFavorite || onToggleCompare) && (
          <div className="absolute bottom-4 left-4 flex gap-2">
            {onToggleFavorite && (
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 bg-white/90 hover:bg-white"
                onClick={() => onToggleFavorite(property.id)}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
              </Button>
            )}
            {onToggleCompare && (
              <Button
                variant="secondary"
                size="icon"
                className={`h-9 w-9 ${isComparing ? 'bg-primary text-primary-foreground' : 'bg-white/90 hover:bg-white'}`}
                onClick={() => onToggleCompare(property.id)}
              >
                <GitCompare className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Property Header ────────────────────────────────────────────────── */}
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="mb-2">{property.title}</CardTitle>
            <CardDescription className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {property.location}
            </CardDescription>
          </div>
        </div>

        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-1">
            <Bed className="w-4 h-4" />
            <span>{property.bedrooms} bed</span>
          </div>
          <div className="flex items-center gap-1">
            <Bath className="w-4 h-4" />
            <span>{property.bathrooms} bath</span>
          </div>
          <div className="flex items-center gap-1">
            <Maximize className="w-4 h-4" />
            <span>{property.sqft} sqft</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{property.yearBuilt}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* ── Price Prediction Section ──────────────────────────────────── */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Current Price</p>
              <p className="text-green-600 font-semibold">{formatCurrency(property.currentPrice)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Predicted Price</p>
              <p className="text-blue-600 font-semibold">{formatCurrency(predictedPrice)}</p>
            </div>
          </div>

          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Prediction Timeframe</span>
              <span className="text-sm">{predictionYears} {predictionYears === 1 ? 'year' : 'years'}</span>
            </div>
            <Slider
              value={[predictionYears]}
              onValueChange={(value) => setPredictionYears(value[0])}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
            <div className="flex items-center gap-2 mt-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-600">
                +{formatCurrency(priceIncrease)} ({percentageIncrease}%)
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                ~{property.appreciationRate}% annual growth
              </span>
            </div>
          </div>

          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="year"
                  label={{ value: 'Years', position: 'insideBottom', offset: -5 }}
                />
                <YAxis tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Year ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="predictedPrice"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Description Toggle ────────────────────────────────────────── */}
        <div>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-0 h-auto"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span>Property Description</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          {isExpanded && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {property.description}
            </p>
          )}
        </div>

        {/* ── View Details button ───────────────────────────────────────── */}
        {property.sourceUrl ? (
          <Button
            className="w-full gap-2"
            onClick={handleViewDetails}
          >
            <ExternalLink className="w-4 h-4" />
            View on {sourceMeta?.label ?? "Listing Site"}
          </Button>
        ) : (
          <Button className="w-full" disabled>
            View Details
          </Button>
        )}
      </CardContent>

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {isLightboxOpen && (
        <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
          <DialogContent className="max-w-7xl w-[95vw] mx-auto p-0 bg-black">
            <VisuallyHidden>
              <DialogTitle>{property.title} - Image Gallery</DialogTitle>
              <DialogDescription>
                View full-size images of {property.title}. Use navigation arrows to browse
                through all {images.length} images.
              </DialogDescription>
            </VisuallyHidden>
            <div className="relative w-full h-[65vh] overflow-hidden group">
              {images.map((image, index) => (
                <div
                  key={index}
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    index === lightboxImageIndex ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <ImageWithFallback
                    src={image}
                    alt={`${property.title} - Image ${index + 1}`}
                    className="w-full h-full object-contain"
                  />
                </div>
              ))}

              {images.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 bg-black/70 hover:bg-black/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={prevLightboxImage}
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 bg-black/70 hover:bg-black/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={nextLightboxImage}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </Button>
                </>
              )}

              {images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm">
                  {lightboxImageIndex + 1} / {images.length}
                </div>
              )}

              <Button
                variant="secondary"
                size="icon"
                className="absolute top-4 right-4 h-10 w-10 bg-black/70 hover:bg-black/90 text-white"
                onClick={() => setIsLightboxOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
