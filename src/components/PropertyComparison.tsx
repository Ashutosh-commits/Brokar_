import { Property } from '../types/property';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { 
  X, 
  Bed, 
  Bath, 
  Maximize, 
  MapPin, 
  Calendar,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { formatCurrency, calculatePricePrediction } from '../utils/priceCalculator';
import { formatIndianNumber } from '../utils/indianNumberFormat';

interface PropertyComparisonProps {
  properties: Property[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoveProperty: (propertyId: string) => void;
}

export function PropertyComparison({ 
  properties, 
  open, 
  onOpenChange,
  onRemoveProperty 
}: PropertyComparisonProps) {
  const predictionYears = 5;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh]">
        <SheetHeader>
          <SheetTitle>Property Comparison ({properties.length})</SheetTitle>
          <SheetDescription>
            Compare properties side by side to make better decisions
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(90vh-100px)] mt-6">
          {properties.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No properties selected for comparison. Select properties from the dashboard to compare.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => {
                const predictedPrice = calculatePricePrediction(property, predictionYears);
                const priceIncrease = predictedPrice - property.currentPrice;
                const percentageIncrease = ((priceIncrease / property.currentPrice) * 100).toFixed(1);

                return (
                  <div key={property.id} className="border rounded-lg overflow-hidden bg-card relative">
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 z-10 h-8 w-8"
                      onClick={() => onRemoveProperty(property.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>

                    <div className="relative h-48">
                      <ImageWithFallback
                        src={property.imageUrl}
                        alt={property.title}
                        className="w-full h-full object-cover"
                      />
                      <Badge className="absolute bottom-2 left-2 bg-white/90 text-black">
                        {property.propertyType}
                      </Badge>
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="mb-1">{property.title}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {property.location}
                        </p>
                      </div>

                      <Separator />

                      {/* Specs */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Bed className="w-4 h-4" />
                            Bedrooms
                          </span>
                          <span>{property.bedrooms}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Bath className="w-4 h-4" />
                            Bathrooms
                          </span>
                          <span>{property.bathrooms}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Maximize className="w-4 h-4" />
                            Sq Ft
                          </span>
                          <span>{property.sqft}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Year Built
                          </span>
                          <span>{property.yearBuilt}</span>
                        </div>
                      </div>

                      <Separator />

                      {/* Pricing */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            Current Price
                          </span>
                          <span className="text-green-600">{formatCurrency(property.currentPrice)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">5yr Prediction</span>
                          <span className="text-blue-600">{formatCurrency(predictedPrice)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            Growth Rate
                          </span>
                          <span className="text-green-600">
                            +{percentageIncrease}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Price/Sq Ft</span>
                          <span>₹{formatIndianNumber(Math.round(property.currentPrice / property.sqft))}</span>
                        </div>
                      </div>

                      <Separator />

                      <div className="bg-muted/50 p-2 rounded text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Appreciation Rate</span>
                          <span>{property.appreciationRate}% annually</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}