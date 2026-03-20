import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { Award, CheckCircle, XCircle, Loader2, ArrowLeft, User, BookOpen, GraduationCap, Calendar } from 'lucide-react';

const VerifyCertificate = () => {
    const { certId } = useParams();
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState(null);

    useEffect(() => {
        verifyCert();
    }, [certId]);

    const verifyCert = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/certificates/verify/${certId}`);
            setResult(res.data);
        } catch (error) {
            setResult({ valid: false, message: 'Error verifying certificate' });
        } finally {
            setLoading(false);
        }
    };

    const issuedDate = result?.certificate?.issued_at
        ? new Date(result.certificate.issued_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        })
        : null;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mx-auto mb-3" />
                    <p className="text-muted-foreground text-opacity-80">Verifying certificate...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
            <div className="max-w-md w-full">
                <Link to="/" className="inline-flex items-center text-sm text-muted-foreground text-opacity-80 hover:text-foreground mb-6">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back to Home
                </Link>

                <div className={`rounded-xl border p-6 ${result?.valid
                        ? 'bg-gradient-to-br from-cyan-500/5 to-emerald-500/5 border-emerald-500/20'
                        : 'bg-card border border-border shadow-sm border-red-500/20'
                    }`}>
                    {/* Status Icon */}
                    <div className="text-center mb-6">
                        {result?.valid ? (
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                                <CheckCircle className="h-8 w-8 text-emerald-400" />
                            </div>
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                                <XCircle className="h-8 w-8 text-red-400" />
                            </div>
                        )}
                        <h1 className={`text-xl font-bold ${result?.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                            {result?.valid ? 'Valid Certificate' : 'Invalid Certificate'}
                        </h1>
                        <p className="text-sm text-muted-foreground text-opacity-60 mt-1">
                            {result?.valid
                                ? 'This certificate has been verified successfully.'
                                : 'This certificate could not be found in our records.'}
                        </p>
                    </div>

                    {/* Certificate Details */}
                    {result?.valid && result?.certificate && (
                        <div className="space-y-3 border-t border-border pt-5">
                            <div className="flex items-center gap-3">
                                <User className="h-4 w-4 text-muted-foreground text-opacity-60 shrink-0" />
                                <div>
                                    <p className="text-xs text-muted-foreground text-opacity-60">Awarded to</p>
                                    <p className="text-sm font-medium text-foreground">{result.certificate.user_name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <BookOpen className="h-4 w-4 text-muted-foreground text-opacity-60 shrink-0" />
                                <div>
                                    <p className="text-xs text-muted-foreground text-opacity-60">Course</p>
                                    <p className="text-sm font-medium text-foreground">{result.certificate.course_title}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <GraduationCap className="h-4 w-4 text-muted-foreground text-opacity-60 shrink-0" />
                                <div>
                                    <p className="text-xs text-muted-foreground text-opacity-60">Instructor</p>
                                    <p className="text-sm font-medium text-foreground">{result.certificate.instructor_name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Calendar className="h-4 w-4 text-muted-foreground text-opacity-60 shrink-0" />
                                <div>
                                    <p className="text-xs text-muted-foreground text-opacity-60">Issued on</p>
                                    <p className="text-sm font-medium text-foreground">{issuedDate}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Award className="h-4 w-4 text-muted-foreground text-opacity-60 shrink-0" />
                                <div>
                                    <p className="text-xs text-muted-foreground text-opacity-60">Certificate ID</p>
                                    <p className="text-xs font-mono text-muted-foreground text-opacity-80 break-all">{result.certificate.certificate_id}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Branding */}
                    <div className="text-center mt-6 pt-4 border-t border-border">
                        <p className="text-xs text-muted-foreground text-opacity-40">Verified by SkillVerse</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerifyCertificate;
